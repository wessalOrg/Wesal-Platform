import { expect, test } from "@playwright/test";
import { askChat, openChat } from "./helpers";

type AssistantPayload = {
  message: string;
  kind: string;
  halls: Array<{ hallId: string; hallName: string; region?: string | null; capacity?: number | null; price?: number | null }>;
  hallDetails?: { hallId: string; hallName: string; region: string; capacity: number; price?: number | null } | null;
  availability?: { hallId: string; date: string; periods: Array<{ startTime: string; endTime: string; status: string }> } | null;
  criteria?: { capacity?: number | null } | null;
  actions?: Array<{ href: string; mode: string }>;
};

async function selectFirstHall(page: Parameters<typeof askChat>[0]) {
  await openChat(page);
  const search = await askWithPayload(page, "بدي صالة بغزة");
  expect(search.payload.halls.length).toBeGreaterThan(0);
  const selected = await askWithPayload(page, "الأولى");
  const hallId = selected.payload.hallDetails?.hallId;
  expect(hallId).toBeTruthy();
  return hallId!;
}

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

test("V7 checks a selected hall's real hourly availability for a requested date", async ({ page }) => {
  const hallId = await selectFirstHall(page);
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await askWithPayload(page, `متى فاضية بتاريخ ${date}`);
  expect(result.payload.kind).toBe("Availability");
  expect(result.payload.availability?.hallId).toBe(hallId);
  expect(result.payload.availability?.date).toBe(date);
  await expect(page.getByTestId("ai-chat-availability").last()).toBeVisible();
});

test("V7 collects booking date, hours and name then returns an unsubmitted preview", async ({ page }) => {
  const hallId = await selectFirstHall(page);
  const date = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const availability = await askWithPayload(page, `متى فاضية بتاريخ ${date}`);
  expect(availability.payload.kind).toBe("Availability");
  expect(availability.payload.availability?.hallId).toBe(hallId);
  expect(availability.payload.availability?.date).toBe(date);
  const bookingPosts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/v1\/halls\/[^/]+\/hourly-bookings/.test(request.url())) {
      bookingPosts.push(request.url());
    }
  });
  const start = await askWithPayload(page, "بدي أحجزها");
  expect(start.payload.kind).toBe("Clarification");
  expect(start.text).toMatch(/وقت|ساع|time/i);
  const timeTurn = await askWithPayload(page, "من 18:00 إلى 20:00");
  expect(timeTurn.payload.kind).toBe("Clarification");
  expect(timeTurn.text).toMatch(/اسم|name/i);
  const preview = await askWithPayload(page, "باسم سامر الخطيب");
  expect(preview.payload.kind).toBe("Answer");
  expect(preview.text).toContain(date);
  expect(preview.text).toContain("18:00");
  expect(preview.text).toContain("20:00");
  expect(preview.text).toContain("سامر الخطيب");
  expect(preview.text).toMatch(/لم يتم إرسال|لم يتم.*حجز/);
  expect(preview.payload.actions?.some((action) => action.href === `/halls/${hallId}`)).toBe(true);
  expect(bookingPosts).toHaveLength(0);
});

test("V7 preview action opens the existing hall booking form", async ({ page }) => {
  const hallId = await selectFirstHall(page);
  const date = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await askWithPayload(page, `بدي أحجزها بتاريخ ${date} من 18:00 إلى 20:00 باسم سامر`);
  const preview = page.getByTestId("ai-chat-message").filter({ hasText: /معاينة طلب الحجز/ }).last();
  await expect(preview).toBeVisible();
  const action = preview.getByTestId("ai-chat-action");
  await expect(action).toHaveAttribute("data-href", `/halls/${hallId}`);
  await action.click();
  await expect(page).toHaveURL(new RegExp(`/halls/${hallId}$`));
  await expect(page.locator(".hall-details-page")).toBeVisible();
  await expect(page.getByTestId("hall-hourly-booking")).toBeVisible();
});
