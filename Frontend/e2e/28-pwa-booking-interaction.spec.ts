import { expect, test, type Page } from "@playwright/test";
import { setupExternalBookings } from "./helpers/external-bookings-fixture";
import { deployPwaUpdate, startPwaUpdateProxy } from "./helpers/pwa-update-proxy";
import { buildPwaLifecycleHarness, mountPwaLifecycle } from "./helpers/pwa-lifecycle-fixture";

let lifecycleBundle: string;
test.beforeAll(async () => { lifecycleBundle = await buildPwaLifecycleHarness(); });
const mountLifecycle = (page: Page, options: Record<string, boolean> = {}) => mountPwaLifecycle(page, lifecycleBundle, options);

test("initial claim is not an update, but the next controller replacement is", async ({ page }) => {
  const { banner, errors } = await mountLifecycle(page);
  await page.evaluate("pwaTest.initialClaim();pwaTest.sw.dispatchEvent(new Event('controllerchange'))");
  await expect(banner).toHaveCount(0);
  await page.evaluate("window.worker=pwaTest.installing();worker.transition('installed');pwaTest.replace(worker)");
  await expect(banner).toHaveCount(1);
  await page.evaluate("pwaTest.sw.dispatchEvent(new Event('controllerchange'));pwaTest.reg.dispatchEvent(new Event('updatefound'))");
  await expect(banner).toHaveCount(1); expect(errors).toEqual([]);
});

test("the production test helper detects a controller replaced before getRegistration resolves", async ({ page }) => {
  const { banner, errors } = await mountLifecycle(page, { controlled: true });
  await page.evaluate(() => {
    const state = (window as unknown as { pwaTest: {
      sw: { getRegistration: () => Promise<unknown> };
      reg: unknown; installing: () => { transition: (state: string) => void }; replace: (worker: unknown) => void;
    } }).pwaTest;
    state.sw.getRegistration = async () => {
      const worker = state.installing(); worker.transition("installed"); state.replace(worker);
      return state.reg;
    };
  });
  await deployPwaUpdate(page, () => undefined);
  await expect(banner).toHaveCount(1);
  expect(await page.evaluate("pwaTest.reg.updateCalls")).toBe(1);
  expect(errors).toEqual([]);
});

test("the first installing worker does not advertise an update when it becomes installed and claims the page", async ({ page }) => {
  const { banner, errors } = await mountLifecycle(page);
  await page.evaluate("window.worker=pwaTest.installing();worker.transition('installed');pwaTest.replace(worker)");
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate("worker.count('statechange')")).toBe(0); expect(errors).toEqual([]);
});

test("an already-waiting update is shown and the update button sends skip-waiting and reloads", async ({ page }) => {
  const { banner, messages } = await mountLifecycle(page, { controlled: true, waiting: true });
  await expect(banner).toBeVisible();
  await Promise.all([page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame()), banner.getByRole("button").click()]);
  await expect.poll(() => messages).toEqual(["WESAL_SKIP_WAITING"]);
});

test("unmount removes worker, controller and visibility listeners, including a pending registration", async ({ page }) => {
  const { errors } = await mountLifecycle(page, { controlled: true });
  await page.evaluate("window.worker=pwaTest.installing()");
  await expect.poll(() => page.evaluate("worker.count('statechange')")).toBe(1);
  await page.locator("#unmount").click();
  expect(await page.evaluate("[worker.count('statechange'),pwaTest.sw.count('controllerchange'),pwaTest.reg.count('updatefound'),pwaTest.visibility.size]")).toEqual([0, 0, 0, 0]);
  expect(errors).toEqual([]);
});

test("a registration resolving after unmount adds no listeners", async ({ page }) => {
  await mountLifecycle(page, { deferRegister: true });
  await page.locator("#unmount").click(); await page.evaluate("pwaTest.resolveRegistration()");
  expect(await page.evaluate("[pwaTest.sw.count('controllerchange'),pwaTest.reg.count('updatefound'),pwaTest.visibility.size]")).toEqual([0, 0, 0]);
});

test("visibility revalidation tolerates offline errors and stops after cleanup", async ({ page }) => {
  const { errors } = await mountLifecycle(page, { controlled: true, failUpdate: true });
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await expect.poll(() => page.evaluate("pwaTest.reg.updateCalls")).toBe(1);
  await page.locator("#unmount").click(); await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  expect(await page.evaluate("pwaTest.reg.updateCalls")).toBe(1); expect(errors).toEqual([]);
});

test("development keeps Service Worker registration disabled and booking controls usable", async ({ page }) => {
  test.skip(!process.env.WESAL_PWA_DEVELOPMENT_URL, "Requires the local development test server");
  await setupExternalBookings(page);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration())).toBeUndefined();
  await expect(page.getByTestId("pwa-update-banner")).toHaveCount(0);
  await page.getByTestId("owner-calendar-add-booking").click();
  const modal = page.getByTestId("owner-add-booking-modal"); await expect(modal).toBeVisible();
  await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0);
});

test.describe("real production Service Worker and booking modal", () => {
  test.skip(!process.env.WESAL_PWA_PRODUCTION_URL, "Requires a local Next production build; see the production URL environment variable");
  let proxy: Awaited<ReturnType<typeof startPwaUpdateProxy>>;
  test.beforeAll(async ({}, info) => {
    proxy = await startPwaUpdateProxy(process.env.WESAL_PWA_PRODUCTION_URL!, info.project.use.baseURL as string);
  });
  test.afterAll(async () => { await proxy?.close(); });

  async function firstControl(page: Page) {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await expect(page.getByTestId("pwa-update-banner")).toHaveCount(0);
  }
  async function deployUpdate(page: Page) {
    await deployPwaUpdate(page, () => proxy.nextDeployment());
    await expect(page.getByTestId("pwa-update-banner")).toHaveCount(1);
  }

  for (const [width, lang] of [[390, "ar"], [768, "ar"], [1366, "ar"], [1366, "en"]] as const)
    test(`fresh installation and genuine update preserve booking saves at ${width}px ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((language) => localStorage.setItem("wesal_ui_lang", language), lang);
    const state = await setupExternalBookings(page); await firstControl(page);
    const opener = page.getByTestId("owner-calendar-add-booking"); await opener.click();
    const modal = page.getByTestId("owner-add-booking-modal"); await expect(modal).toBeVisible();
    await expect(page.getByTestId("owner-add-booking-overlay")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    expect(await page.getByTestId("owner-add-booking-overlay").evaluate((element) => element.parentElement === document.body)).toBe(true);
    await modal.getByTestId("owner-add-booking-customer").fill("Production Update Booking");
    await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
    await deployUpdate(page);
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));
    await expect(page.getByTestId("pwa-update-banner")).toHaveCount(1);
    const save = modal.getByTestId("owner-add-booking-save");
    await save.focus(); await page.keyboard.press("Tab"); await expect(modal.getByTestId("owner-add-booking-close")).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(save).toBeFocused();
    expect(await save.evaluate((element) => { const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
    await save.click(); await expect(modal).toHaveCount(0);
    expect(state.rows).toHaveLength(1); expect(state.submissions).toHaveLength(1);
    await expect(opener).toBeFocused();
    const banner = page.getByTestId("pwa-update-banner");
    await Promise.all([page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame()), banner.getByRole("button").click()]);
    await expect(page.getByTestId("owner-bookings-calendar-page")).toBeVisible();
    await expect(banner).toHaveCount(0);
  });

  test("an available update does not block cancellation, closing, Escape or portaled date/time controls", async ({ page }) => {
    const state = await setupExternalBookings(page); await firstControl(page); await deployUpdate(page);
    const opener = page.getByTestId("owner-calendar-add-booking"); await opener.click();
    const modal = page.getByTestId("owner-add-booking-modal");
    await modal.getByTestId("owner-add-booking-date").click();
    await expect(page.getByTestId("owner-add-booking-date-calendar")).toBeVisible();
    await page.getByTestId("owner-add-booking-date-calendar").getByRole("button").last().focus();
    await page.keyboard.press("Tab"); await expect(modal.getByTestId("owner-add-booking-close")).toBeFocused();
    await modal.getByTestId("owner-add-booking-time-from").click();
    await expect(page.getByTestId("owner-add-booking-time-from-menu")).toBeVisible();
    await page.getByTestId("owner-add-booking-time-from-menu").getByRole("option").first().click();
    await modal.locator("footer").getByRole("button").first().click(); await expect(modal).toHaveCount(0);
    await expect(opener).toBeFocused(); await opener.click();
    await modal.getByTestId("owner-add-booking-close").click(); await expect(modal).toHaveCount(0);
    await opener.click(); await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0);
    expect(state.submissions).toHaveLength(0); await expect(page.getByTestId("pwa-update-banner")).toHaveCount(1);
  });
});
