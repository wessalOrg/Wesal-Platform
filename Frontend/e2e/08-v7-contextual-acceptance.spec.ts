import { expect, test } from "@playwright/test";
import { askChat, openChat } from "./helpers";

type AssistantPayload = {
  message: string;
  kind: string;
  halls: Array<{ hallId: string; hallName: string; region?: string | null; capacity?: number | null; price?: number | null }>;
  hallDetails?: { hallId: string; hallName: string; region: string; capacity: number; price?: number | null } | null;
  criteria?: { capacity?: number | null } | null;
  actions?: Array<{ href: string; mode: string }>;
};

async function askWithPayload(page: Parameters<typeof askChat>[0], question: string) {
  const pending = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST"
      && /^\/api\/v1\/ai\/sessions\/[^/]+\/assistant$/.test(url.pathname);
  });
  const text = await askChat(page, question);
  const response = await pending;
  return { text, payload: await response.json() as AssistantPayload };
}

test("V7 preserves Gaza, capacity and budget when recommending from the search", async ({ page }) => {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة لـ200 شخص وميزانيتي 3000 شيكل");
  expect(search.payload.halls.length).toBeGreaterThan(0);
  expect(search.payload.halls.every((hall) => /gaza|غزة/i.test(hall.region ?? ""))).toBe(true);
  expect(search.payload.halls.every((hall) => hall.capacity != null && hall.capacity >= 200)).toBe(true);
  expect(search.payload.halls.every((hall) => hall.price == null || hall.price <= 3000)).toBe(true);

  const recommendation = await askWithPayload(page, "مين الأنسب وليش؟");
  expect(recommendation.payload.kind).not.toBe("Clarification");
  expect(recommendation.payload.hallDetails).toBeTruthy();
  expect(recommendation.payload.hallDetails!.capacity).toBeGreaterThanOrEqual(200);
  expect(recommendation.payload.hallDetails!.price == null || recommendation.payload.hallDetails!.price! <= 3000).toBe(true);
  expect(recommendation.payload.hallDetails!.region).toMatch(/gaza|غزة/i);
  expect(recommendation.text.length).toBeGreaterThan(20);
});

test("V7 takes me there opens a real hall page and keeps chat context", async ({ page }) => {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة");
  expect(search.payload.halls.length).toBeGreaterThan(0);
  const selected = await askWithPayload(page, "الأولى");
  const hallId = selected.payload.hallDetails?.hallId ?? selected.payload.halls[0]?.hallId;
  expect(hallId).toBeTruthy();
  const expected = `/halls/${hallId}`;
  const navigation = page.waitForURL((url) => url.pathname === expected, { timeout: 30000 });
  const turn = await askWithPayload(page, "وديني هناك");
  expect(turn.payload.actions?.some((action) => action.href === expected && action.mode === "auto")).toBe(true);
  await navigation;
  await expect(page.locator(".hall-details-page")).toBeVisible({ timeout: 30000 });
  await openChat(page);
  await expect(page.getByTestId("ai-chat-thread")).toContainText("وديني هناك");
});

test("V7 finds another hall without repeating the selected hall", async ({ page }) => {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة");
  expect(search.payload.halls.length).toBeGreaterThan(1);
  const selected = await askWithPayload(page, "الأولى");
  const selectedId = selected.payload.hallDetails?.hallId ?? selected.payload.halls[0]?.hallId;
  expect(selectedId).toBeTruthy();
  const other = await askWithPayload(page, "شو غيرها موجود");
  expect(other.payload.hallDetails).toBeTruthy();
  expect(other.payload.hallDetails!.hallId).not.toBe(selectedId);
});

test("V7 answers platform services in a hall conversation and resumes the hall", async ({ page }) => {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة");
  expect(search.payload.halls.length).toBeGreaterThan(0);
  const selected = await askWithPayload(page, "الأولى");
  const hallId = selected.payload.hallDetails?.hallId ?? selected.payload.halls[0]?.hallId ?? search.payload.halls[0].hallId;
  const services = await askWithPayload(page, "شو بتقدموا؟");
  expect(services.text).toContain("وصال");
  const resume = await askWithPayload(page, "ارجع للصالة");
  expect(resume.payload.actions?.some((action) => action.href === `/halls/${hallId}`)).toBe(true);
});

test("V7 exhaustion follow-up asks a safe clarification", async ({ page }) => {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة لـ200 شخص وميزانيتي 3000 شيكل");
  expect(search.payload.halls.length).toBeGreaterThan(0);
  const seen = new Set(search.payload.halls.map((hall) => hall.hallId));
  let exhausted = search;
  for (let attempt = 0; attempt < 8 && exhausted.payload.kind !== "Answer"; attempt += 1) {
    exhausted = await askWithPayload(page, "شو غيرها موجود");
    if (exhausted.payload.hallDetails) seen.add(exhausted.payload.hallDetails.hallId);
  }
  expect(exhausted.payload.kind).toBe("Answer");
  expect(exhausted.text).toContain("آخر نتيجة");
  const continuation = await askWithPayload(page, "طيب آه دور");
  expect(continuation.payload.kind).toBe("Clarification");
  expect(continuation.text).not.toMatch(/تعذر إكمال|خطأ|error/i);
  expect(continuation.text.length).toBeGreaterThan(10);
});
