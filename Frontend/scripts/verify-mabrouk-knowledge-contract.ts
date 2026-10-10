/**
 * Focused contract checks for the Admin Mabrouk Knowledge Studio.
 * Run: npm run verify:mabrouk-knowledge
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import api from "../src/lib/api";
import { ADMIN_MABROUK_PATH } from "../src/lib/account-profile-path";
import { catalogs } from "../src/i18n/translate";
import { adminMabroukService } from "../src/services/admin-mabrouk";

const root = join(__dirname, "..");
const src = join(root, "src");
let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function readSource(path: string) {
  return readFileSync(join(src, path), "utf8");
}

type Call = {
  method: "get" | "post" | "put";
  url: string;
  data?: unknown;
  config?: unknown;
};

function lastCall(calls: Call[]): Call {
  const call = calls[calls.length - 1];
  assert.ok(call, "expected an HTTP request");
  return call;
}

async function main() {
  check("all six private Admin Studio routes exist under the shared admin guard", () => {
    assert.equal(ADMIN_MABROUK_PATH, "/admin/mabrouk");
    const routes = [
      "app/admin/mabrouk/page.tsx",
      "app/admin/mabrouk/knowledge/page.tsx",
      "app/admin/mabrouk/unanswered/page.tsx",
      "app/admin/mabrouk/simulator/page.tsx",
      "app/admin/mabrouk/analytics/page.tsx",
      "app/admin/mabrouk/history/page.tsx",
    ];
    for (const route of routes) assert.ok(existsSync(join(src, route)), `missing ${route}`);
    assert.match(readSource("app/admin/layout.tsx"), /<AdminManagementGuard>/);
  });

  check("the Admin sidebar links the Studio and exposes its unresolved-gap badge", () => {
    const sidebar = readSource("components/admin/AdminSidebar.tsx");
    assert.match(sidebar, /ADMIN_MABROUK_PATH/);
    assert.match(sidebar, /admin-nav-mabrouk/);
    assert.match(sidebar, /admin-nav-mabrouk-gaps/);
    assert.match(sidebar, /gapCount\(\)/);
  });

  check("Arabic and English catalogs provide matching Studio translations", () => {
    const arabicKeys = Object.keys(catalogs.ar).filter((key) => key.startsWith("admin.mabrouk.")).sort();
    const englishKeys = Object.keys(catalogs.en).filter((key) => key.startsWith("admin.mabrouk.")).sort();
    assert.ok(arabicKeys.length >= 80, `expected substantial Studio copy, found ${arabicKeys.length} keys`);
    assert.deepEqual(englishKeys, arabicKeys);
    assert.ok(arabicKeys.some((key) => key.endsWith(".title")));
  });

  const calls: Call[] = [];
  const saved = {
    get: api.get.bind(api),
    post: api.post.bind(api),
    put: api.put.bind(api),
  };
  const stub = api as unknown as {
    get: (url: string, config?: unknown) => Promise<{ data: unknown }>;
    post: (url: string, data?: unknown) => Promise<{ data: unknown }>;
    put: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  };

  stub.get = async (url, config) => {
    calls.push({ method: "get", url, config });
    return { data: url.endsWith("/count") ? { count: 3 } : [] };
  };
  stub.post = async (url, data) => {
    calls.push({ method: "post", url, data });
    return { data: {} };
  };
  stub.put = async (url, data) => {
    calls.push({ method: "put", url, data });
    return { data: {} };
  };

  try {
    await checkAsync("knowledge filters reach the Admin endpoint unchanged", async () => {
      await adminMabroukService.listKnowledge({ source: "dynamic", publicationStatus: "Draft" });
      assert.deepEqual(lastCall(calls), {
        method: "get",
        url: "/admin/mabrouk/knowledge",
        config: { params: { source: "dynamic", publicationStatus: "Draft" } },
      });
    });

    await checkAsync("publish and rollback send their confirmation notes to the matching article routes", async () => {
      await adminMabroukService.publish("article/one", "Verified by Admin");
      assert.deepEqual(lastCall(calls), {
        method: "post",
        url: "/admin/mabrouk/knowledge/article%2Fone/publish",
        data: { changeNote: "Verified by Admin" },
      });
      await adminMabroukService.rollback("article/one", "revision/three", "Restore verified wording");
      assert.deepEqual(lastCall(calls), {
        method: "post",
        url: "/admin/mabrouk/knowledge/article%2Fone/rollback/revision%2Fthree",
        data: { changeNote: "Restore verified wording" },
      });
    });

    await checkAsync("draft simulation and full-assistant preview remain distinct request modes", async () => {
      await adminMabroukService.simulate("مين طور مبروك؟", "ar", true, "draft-1");
      assert.deepEqual(lastCall(calls), {
        method: "post",
        url: "/admin/mabrouk/simulate",
        data: {
          question: "مين طور مبروك؟",
          language: "ar",
          testDraft: true,
          draftArticleId: "draft-1",
          fullAssistant: false,
          pagePath: null,
          hallId: null,
        },
      });
      await adminMabroukService.simulate("Find halls", "en", false, undefined, true, "/halls", "hall-1");
      assert.deepEqual(lastCall(calls), {
        method: "post",
        url: "/admin/mabrouk/simulate",
        data: {
          question: "Find halls",
          language: "en",
          testDraft: false,
          draftArticleId: null,
          fullAssistant: true,
          pagePath: "/halls",
          hallId: "hall-1",
        },
      });
    });

    await checkAsync("gap counts and create-answer flow use the dedicated inbox endpoints", async () => {
      assert.equal(await adminMabroukService.gapCount(), 3);
      assert.deepEqual(lastCall(calls), { method: "get", url: "/admin/mabrouk/unanswered/count", config: undefined });
      await adminMabroukService.createArticleFromGap("gap-1");
      assert.deepEqual(lastCall(calls), {
        method: "post",
        url: "/admin/mabrouk/unanswered/gap-1/create-article",
        data: undefined,
      });
    });
  } finally {
    (api as unknown as { get: unknown }).get = saved.get;
    (api as unknown as { post: unknown }).post = saved.post;
    (api as unknown as { put: unknown }).put = saved.put;
  }

  console.log(`\n${passed} Mabrouk Knowledge Studio checks passed`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
