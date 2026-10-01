/**
 * Executable verification for the contextual Mabrouk assistant (frontend side).
 * Run: npm run verify:assistant
 *
 * Covers: the route contract with the backend registry, navigation-href sanitising,
 * the page-context envelope, response mapping (actions, hourly slots), the session
 * storage snapshot, the one-shot expired-session recovery, request payload hygiene and
 * the placement/behaviour guarantees of the components (checked from source).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import api from "../src/lib/api";
import {
  AI_CHAT_MAX_AGE_MS,
  AI_CHAT_MAX_MESSAGES,
  parseChatSnapshot,
  serializeChatSnapshot,
} from "../src/lib/ai-chat-storage";
import {
  ASSISTANT_STATIC_ROUTES,
  buildAssistantPageContext,
  hallIdFromPathname,
  sanitizeAssistantHref,
} from "../src/lib/wesal-routes";
import {
  mapAssistantActions,
  mapAssistantResponse,
  sendAiChatTurn,
  sendTurnWithRecovery,
} from "../src/services/ai-chat";
import type { AiChatMessage } from "../src/types/ai-chat";

const root = join(__dirname, "..");
const src = join(root, "src");
const repo = join(root, "..");
const HALL = "11111111-1111-1111-1111-111111111111";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function read(rel: string): string {
  return readFileSync(join(src, rel), "utf8");
}

function pageRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        const rel = dir.slice(join(src, "app").length).replace(/\\/g, "/");
        out.push((rel || "/").replace(/\[[^\]]+\]/g, "{id}"));
      }
    }
  };
  walk(join(src, "app"));
  return out;
}

async function main() {
  // ───────────── route contract ─────────────
  await check("every assistant route is a real Frontend page", () => {
    const real = new Set(pageRoutes());
    for (const route of ASSISTANT_STATIC_ROUTES) {
      assert.ok(real.has(route), `no page.tsx for ${route}`);
    }
  });

  await check("frontend route list equals the backend navigation registry (navigable static pages)", () => {
    const cs = readFileSync(
      join(repo, "Backend", "src", "Wesal.Application", "Ai", "Navigation", "WesalNavigationRegistry.cs"),
      "utf8",
    );
    const entries = [...cs.matchAll(/Page\(\w+,\s*"([^"]+)",\s*"[^"]*",\s*"[^"]*",\s*(true|false),\s*(true|false)/g)];
    assert.ok(entries.length > 20, "registry entries not parsed");
    const backend = entries
      .filter((m) => m[3] === "true" && !m[1].includes("{id}"))
      .map((m) => m[1])
      .sort();
    assert.deepEqual([...ASSISTANT_STATIC_ROUTES].sort(), backend);
  });

  await check("there is no photography route and none is allowed", () => {
    assert.ok(!pageRoutes().some((route) => /photo|media|vendor/i.test(route)));
    assert.ok(!ASSISTANT_STATIC_ROUTES.some((route) => /photo/i.test(route)));
    assert.equal(sanitizeAssistantHref("/photography"), null);
  });

  // ───────────── navigation href safety ─────────────
  await check("sanitizeAssistantHref accepts only real internal routes", () => {
    for (const ok of ["/", "/halls", "/faq", "/help", "/login", "/register", "/profile/bookings", `/halls/${HALL}`]) {
      assert.equal(sanitizeAssistantHref(ok), ok);
    }
    assert.equal(sanitizeAssistantHref("/faq/"), "/faq");
  });

  await check("sanitizeAssistantHref rejects external, protocol, traversal and invented targets", () => {
    for (const bad of [
      "https://evil.example",
      "http://evil.example/halls",
      "//evil.example/halls",
      "javascript:alert(1)",
      "data:text/html,x",
      "/photography",
      "/halls/../admin",
      "/halls?x=1",
      "/halls#x",
      "\\\\evil\\share",
      "/halls/not-a-guid",
      "/admin",
      "/owner/halls/abc",
      "halls",
      "",
      null,
      undefined,
      5,
      {},
    ]) {
      assert.equal(sanitizeAssistantHref(bad), null, String(bad));
    }
  });

  await check("mapAssistantActions drops invalid actions, dedupes, bounds and defaults to suggest", () => {
    const actions = mapAssistantActions([
      { type: "Navigate", pageKey: "halls", href: "/halls", label: "استعرض الصالات", mode: "auto" },
      { type: "Navigate", pageKey: "halls", href: "/halls", label: "dup", mode: "auto" },
      { type: "Navigate", pageKey: "evil", href: "https://evil.example", label: "x", mode: "auto" },
      { type: "Navigate", pageKey: "faq", href: "/faq", label: "FAQ" },
      { type: "Open", pageKey: "help", href: "/help", label: "x" },
      { type: "Navigate", pageKey: "help", href: "/help", label: "" },
      { type: "Navigate", pageKey: "login", href: "/login", label: "Login", mode: "suggest" },
      { type: "Navigate", pageKey: "register", href: "/register", label: "Register" },
    ]);
    assert.deepEqual(
      actions.map((a) => [a.href, a.mode]),
      [["/halls", "auto"], ["/faq", "suggest"], ["/login", "suggest"]],
    );
    assert.deepEqual(mapAssistantActions(null), []);
    assert.deepEqual(mapAssistantActions("nope" as never), []);
  });

  // ───────────── page context ─────────────
  await check("buildAssistantPageContext sends a validated pathname only and redacts private ids", () => {
    assert.deepEqual(buildAssistantPageContext("/halls"), { pathname: "/halls" });
    assert.deepEqual(buildAssistantPageContext(`/halls/${HALL}?utm=1#x`), { pathname: `/halls/${HALL}` });
    assert.deepEqual(buildAssistantPageContext("/halls/not-a-guid"), { pathname: "/halls/_" });
    assert.deepEqual(buildAssistantPageContext("/messages/secret-conversation-id"), { pathname: "/messages/_" });
    assert.deepEqual(buildAssistantPageContext("/owner/halls/abc123/notifications"), { pathname: "/owner/halls/_/notifications" });
    assert.deepEqual(buildAssistantPageContext("/admin/halls/xyz"), { pathname: "/admin/halls/_" });
    assert.deepEqual(buildAssistantPageContext("/profile/bookings?booking_id=123"), { pathname: "/profile/bookings" });
    assert.equal(buildAssistantPageContext("/totally/unknown"), null);
    assert.equal(buildAssistantPageContext("//evil.example"), null);
    assert.equal(buildAssistantPageContext("https://evil.example"), null);
    assert.equal(buildAssistantPageContext(null), null);
    assert.equal(hallIdFromPathname(`/halls/${HALL}`), HALL);
    assert.equal(hallIdFromPathname("/halls/xyz"), null);
  });

  // ───────────── response mapping ─────────────
  await check("mapAssistantResponse keeps hall cards, details and navigation actions", () => {
    const turn = mapAssistantResponse({
      kind: "Halls",
      message: "found",
      responseLanguage: "ar",
      halls: [{ hallId: HALL, hallName: "قاعة النخيل", capacity: 400, price: 7000 }],
      actions: [{ type: "Navigate", pageKey: "halls", href: "/halls", label: "استعرض", mode: "suggest" }],
    });
    assert.equal(turn.halls.length, 1);
    assert.equal(turn.halls[0]?.price, 7000);
    assert.equal(turn.actions[0]?.href, "/halls");

    const details = mapAssistantResponse({
      kind: "HallDetails",
      message: "x",
      hallDetails: { hallId: HALL, hallName: "قاعة النخيل", status: "Approved", capacity: 400, price: 7000 },
    });
    assert.equal(details.halls[0]?.hallId, HALL);
    assert.equal(details.halls[0]?.isAvailable, true);
  });

  await check("availability maps the backend's hourly `slots` (not only legacy `periods`)", () => {
    const turn = mapAssistantResponse({
      kind: "Availability",
      message: "x",
      availability: {
        hallId: HALL,
        hallName: "قاعة النخيل",
        date: "2026-10-02",
        slots: [
          { startTime: "09:00:00", endTime: "10:00:00", status: "Available" },
          { startTime: "10:00:00", endTime: "11:00:00", status: "Booked" },
          { startTime: "11:00:00", endTime: "12:00:00", status: "Reserved" },
        ],
      },
    });
    assert.equal(turn.availability?.periods.length, 3);
    assert.equal(turn.availability?.periods[1]?.status, "Booked");
    assert.equal(turn.availability?.periods[2]?.status, "Reserved");
    assert.equal(turn.availability?.periods[0]?.startTime, "09:00:00");
  });

  await check("unknown kinds and missing fields never throw", () => {
    const turn = mapAssistantResponse({ kind: "SomethingNew", message: "hi" });
    assert.equal(turn.text, "hi");
    assert.deepEqual(turn.actions, []);
    assert.equal(mapAssistantResponse({ kind: "Answer", message: "x", actions: null }).actions.length, 0);
  });

  // ───────────── request payload + recovery ─────────────
  const originalPost = api.post.bind(api);
  type Call = { url: string; body: Record<string, unknown> };
  let calls: Call[] = [];
  function mockPost(responder: (call: Call) => { status: number; data: unknown }) {
    calls = [];
    (api as unknown as { post: unknown }).post = async (url: string, body: Record<string, unknown>) => {
      const call = { url, body };
      calls.push(call);
      return responder(call);
    };
  }
  const ok = (message: string) => ({ status: 200, data: { kind: "Answer", message, responseLanguage: "ar" } });

  await check("the request carries page + pinned hall id only, never names/prices/tokens", async () => {
    mockPost(() => ok("x"));
    await sendAiChatTurn("sess-1", "كم سعرها؟", {
      page: { pathname: `/halls/${HALL}` },
      pinned: { type: "hall", id: HALL, name: "قاعة النخيل" },
    });
    const body = calls[0]!.body;
    assert.equal(body.message, "كم سعرها؟");
    assert.deepEqual(body.page, { pathname: `/halls/${HALL}` });
    assert.deepEqual(body.entity, { type: "hall", id: HALL, name: "قاعة النخيل" });
    const json = JSON.stringify(body);
    assert.ok(!/price|capacity|phone|availability|token|bearer|authorization/i.test(json), json);
  });

  await check("an invalid pinned id is never sent", async () => {
    mockPost(() => ok("x"));
    await sendAiChatTurn("sess-1", "hello", {
      page: null,
      pinned: { type: "hall", id: "eyJhbGciOi.jwt.like", name: null },
    });
    assert.equal(calls[0]!.body.entity, null);
  });

  await check("expired session (404): one new session, the turn replayed once, id updated", async () => {
    let n = 0;
    mockPost(() => (++n === 1 ? { status: 404, data: {} } : ok("answered")));
    let renewals = 0;
    const result = await sendTurnWithRecovery("old", "hi", {}, async () => {
      renewals += 1;
      return "fresh";
    });
    assert.equal(renewals, 1);
    assert.equal(result.sessionId, "fresh");
    assert.equal(result.turn.text, "answered");
    assert.equal(result.turn.sessionExpired, false);
    assert.equal(calls.length, 2);
    assert.ok(calls[0]!.url.includes("/old/"));
    assert.ok(calls[1]!.url.includes("/fresh/"));
  });

  await check("recovery never loops: a second 404 surfaces after exactly one renewal", async () => {
    mockPost(() => ({ status: 404, data: {} }));
    let renewals = 0;
    const result = await sendTurnWithRecovery("old", "hi", {}, async () => {
      renewals += 1;
      return "fresh";
    });
    assert.equal(renewals, 1);
    assert.equal(calls.length, 2);
    assert.equal(result.turn.sessionExpired, true);
  });

  await check("recovery is skipped when renewal fails and when the turn succeeds", async () => {
    mockPost(() => ({ status: 404, data: {} }));
    const failed = await sendTurnWithRecovery("old", "hi", {}, async () => null);
    assert.equal(failed.turn.sessionExpired, true);
    assert.equal(calls.length, 1);

    mockPost(() => ok("fine"));
    let renewed = false;
    const fine = await sendTurnWithRecovery("old", "hi", {}, async () => {
      renewed = true;
      return "x";
    });
    assert.equal(fine.turn.text, "fine");
    assert.equal(renewed, false);
  });

  (api as unknown as { post: unknown }).post = originalPost;

  // ───────────── session storage snapshot ─────────────
  const message = (id: string, role: "user" | "assistant", text: string): AiChatMessage => ({
    id,
    role,
    text,
    createdAt: "2026-10-01T10:00:00.000Z",
    variant: "default",
    halls: [],
    recommendationStatus: null,
    criteria: null,
    lang: null,
    category: null,
    availability: null,
    actions: [],
  });
  const now = Date.parse("2026-10-01T10:00:00Z");
  const base = {
    lang: "ar",
    sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    pinned: { type: "hall" as const, id: HALL, name: "قاعة النخيل" },
  };

  await check("storage round-trips the visible thread, pinned hall and session id", () => {
    const json = serializeChatSnapshot({ ...base, messages: [message("greeting", "assistant", "hi"), message("1", "user", "كم سعرها؟"), message("2", "assistant", "7000")] }, now);
    const snapshot = parseChatSnapshot(json, now + 1000, "ar");
    assert.ok(snapshot);
    assert.deepEqual(snapshot.messages.map((m) => m.id), ["1", "2"]); // greeting is never stored
    assert.equal(snapshot.pinned?.id, HALL);
    assert.equal(snapshot.sessionId, base.sessionId);
  });

  await check("storage rejects stale, foreign-language, wrong-version and corrupt snapshots", () => {
    const json = serializeChatSnapshot({ ...base, messages: [message("1", "user", "x")] }, now);
    assert.equal(parseChatSnapshot(json, now + AI_CHAT_MAX_AGE_MS + 1000, "ar"), null);
    assert.equal(parseChatSnapshot(json, now + 1000, "en"), null);
    assert.equal(parseChatSnapshot(json.replace('"v":1', '"v":2'), now + 1000, "ar"), null);
    assert.equal(parseChatSnapshot("{not json", now, "ar"), null);
    assert.equal(parseChatSnapshot(null, now, "ar"), null);
    assert.equal(parseChatSnapshot('{"v":1,"savedAt":"x"}', now, "ar"), null);
  });

  await check("storage is bounded, sanitised and never re-triggers auto navigation", () => {
    const many = Array.from({ length: 100 }, (_, i) => message(String(i), i % 2 ? "assistant" : "user", `m${i}`));
    const withAction: AiChatMessage = {
      ...message("act", "assistant", "opening"),
      actions: [{ type: "Navigate", pageKey: "halls", href: "/halls", label: "x", mode: "auto" }],
    };
    const json = serializeChatSnapshot({ ...base, messages: [...many, withAction] }, now);
    const snapshot = parseChatSnapshot(json, now, "ar")!;
    assert.equal(snapshot.messages.length, AI_CHAT_MAX_MESSAGES);
    assert.equal(snapshot.messages.at(-1)?.actions[0]?.mode, "suggest");

    const hostile = parseChatSnapshot(
      JSON.stringify({
        v: 1,
        savedAt: now,
        lang: "ar",
        sessionId: "../../etc/passwd",
        messages: [{ id: "1", role: "system", text: "x" }, { id: "2", role: "user", text: "ok", variant: "<script>" }, 7, null],
        pinned: { type: "hall", id: "not-a-guid", name: "x" },
      }),
      now,
      "ar",
    )!;
    assert.equal(hostile.sessionId, null);
    assert.equal(hostile.pinned, null);
    assert.deepEqual(hostile.messages.map((m) => m.id), ["2"]);
    assert.equal(hostile.messages[0]?.variant, "default");

    assert.ok(!/bearer|token|authorization|password/i.test(json));
  });

  // ───────────── components: placement and behaviour (from source) ─────────────
  await check("the hall button exists on hall-detail surfaces only (page + modal), not on catalog cards", () => {
    assert.ok(read("components/halls/HallDetailsPage.tsx").includes("AskMabroukAboutHallButton"));
    assert.ok(read("components/halls/HallDetailsView.tsx").includes("AskMabroukAboutHallButton"));
    const walk = (dir: string, hits: string[]) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, hits);
        else if (/\.(tsx|ts)$/.test(entry) && read(full.slice(src.length + 1).replace(/\\/g, "/")).includes("AskMabroukAboutHallButton")) {
          hits.push(full.slice(src.length + 1).replace(/\\/g, "/"));
        }
      }
    };
    const hits: string[] = [];
    walk(src, hits);
    assert.deepEqual(hits.sort(), [
      "components/assistant/AskMabroukAboutHallButton.tsx",
      "components/halls/HallDetailsPage.tsx",
      "components/halls/HallDetailsView.tsx",
    ]);
    for (const catalog of ["components/halls/HallsCatalogView.tsx", "components/home/FeaturedHallsSection.tsx"]) {
      assert.ok(!read(catalog).includes("AskMabroukAboutHallButton"), catalog);
    }
  });

  await check("button copy is the exact approved Arabic and English text", () => {
    assert.ok(read("i18n/messages/ar.ts").includes('"assistant.hallButton": "اسأل مبروك عن هذه الصالة"'));
    assert.ok(read("i18n/messages/en.ts").includes('"assistant.hallButton": "Ask Mabrouk about this hall"'));
    assert.ok(read("i18n/messages/ar.ts").includes('"assistant.context.asking": "تسأل عن: {name}"'));
  });

  await check("the button pins context via the launcher (no message, no model call) and is accessible", () => {
    const button = read("components/assistant/AskMabroukAboutHallButton.tsx");
    assert.ok(button.includes("launcher.openWithContext"));
    assert.ok(!button.includes("send("));
    assert.ok(button.includes("aria-label"));
    assert.ok(button.includes('type="button"'));
    assert.ok(button.includes("focus-visible"));
  });

  await check("the provider owns the thread, does not close on navigation and recovers sessions", () => {
    const provider = read("components/assistant/AiAssistantProvider.tsx");
    assert.ok(provider.includes("useAiChat({"));
    assert.ok(!/closeAssistant\(\)[\s\S]{0,40}\[pathname/.test(provider), "must not close on pathname change");
    assert.ok(provider.includes("renewSession: controls.renewSession"));
    assert.ok(provider.includes("sanitizeAssistantHref"));
    assert.ok(provider.includes("handledAutoRef"));
    assert.ok(provider.includes("readChatSnapshot") && provider.includes("writeChatSnapshot"));
    const panel = read("components/assistant/AiAssistantPanel.tsx");
    assert.ok(!panel.includes("useAiChat("), "the panel must not own the chat state");
    assert.ok(panel.includes("ai-context-chip"));
    assert.ok(read("components/assistant/AiChatComposer.tsx").includes("focusToken"));
    assert.ok(read("components/assistant/AiChatMessage.tsx").includes("ai-chat-action"));
  });

  await check("chat state does not reset on a new session id (only on language change)", () => {
    const hook = read("hooks/useAiChat.ts");
    assert.ok(hook.includes("greetingChanged"));
    assert.ok(!/sessionChanged/.test(hook));
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
