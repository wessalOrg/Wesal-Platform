import { expect, test, type Page } from "@playwright/test";
import { buildPwaLifecycleHarness, mountPwaLifecycle } from "./helpers/pwa-lifecycle-fixture";
import { setupExternalBookings } from "./helpers/external-bookings-fixture";
import { deployPwaUpdate, startPwaUpdateProxy } from "./helpers/pwa-update-proxy";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

let bundle: string;
test.beforeAll(async () => { bundle = await buildPwaLifecycleHarness(true); });

test("English update banner follows the selected language and LTR direction", async ({ page }) => {
  const { banner } = await mountPwaLifecycle(page, bundle, { controlled: true, waiting: true }, "en");
  await expect(banner).toHaveAttribute("dir", "ltr");
  await expect(banner).toContainText("A new version of Wesal is available");
  await expect(banner.getByRole("button", { name: "Update", exact: true })).toBeVisible();
});

test("Arabic update banner preserves its translated message, button and RTL direction", async ({ page }) => {
  const { banner, errors } = await mountPwaLifecycle(page, bundle, { controlled: true, waiting: true }, "ar");
  await expect(banner).toHaveAttribute("dir", "rtl"); await expect(banner).toHaveAttribute("lang", "ar");
  await expect(banner).toContainText(ar["pwa.updateAvailable"]);
  await expect(banner.getByRole("button", { name: ar["pwa.updateAction"], exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const initial of ["ar", "en"] as const) test(`${initial}: changing language keeps the visible update and its lifecycle listeners`, async ({ page }) => {
  const { banner, errors } = await mountPwaLifecycle(page, bundle, { controlled: true, waiting: true }, initial);
  await expect(banner).toHaveCount(1); await page.evaluate("window.originalBanner=document.querySelector('[data-testid=pwa-update-banner]')");
  const next = initial === "ar" ? "en" : "ar", catalog = next === "ar" ? ar : en;
  await page.locator("#language-" + next).click();
  await expect(banner).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr"); await expect(banner).toHaveAttribute("lang", next);
  await expect(banner).toContainText(catalog["pwa.updateAvailable"]);
  await expect(banner.getByRole("button", { name: catalog["pwa.updateAction"], exact: true })).toBeVisible();
  expect(await banner.evaluate(element => element === (window as unknown as { originalBanner: Element }).originalBanner)).toBe(true);
  expect(await page.evaluate("[pwaTest.reg.registerCalls,pwaTest.sw.count('controllerchange'),pwaTest.reg.count('updatefound'),pwaTest.visibility.size]")).toEqual([1, 1, 1, 1]);
  await page.evaluate("pwaTest.sw.dispatchEvent(new Event('controllerchange'))"); await expect(banner).toHaveCount(1);
  await page.locator("#unmount").click(); expect(await page.evaluate("[pwaTest.sw.count('controllerchange'),pwaTest.reg.count('updatefound'),pwaTest.visibility.size]")).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

for (const lang of ["ar", "en"] as const) test(`${lang}: keyboard update posts skip-waiting and reloads`, async ({ page }) => {
  const { banner, messages } = await mountPwaLifecycle(page, bundle, { controlled: true, waiting: true }, lang);
  const button = banner.getByRole("button", { name: (lang === "ar" ? ar : en)["pwa.updateAction"], exact: true });
  await button.focus(); await expect(button).toBeFocused();
  await Promise.all([page.waitForEvent("framenavigated", frame => frame === page.mainFrame()), page.keyboard.press("Enter")]);
  await expect.poll(() => messages).toEqual(["WESAL_SKIP_WAITING"]);
});

for (const lang of ["ar", "en"] as const) test(`${lang}: initial installation remains silent and a genuine replacement creates one translated banner`, async ({ page }) => {
  const { banner, errors } = await mountPwaLifecycle(page, bundle, {}, lang);
  await page.evaluate("window.worker=pwaTest.installing();worker.transition('installed');pwaTest.replace(worker)"); await expect(banner).toHaveCount(0);
  await page.evaluate("window.nextWorker=pwaTest.installing();nextWorker.transition('installed');pwaTest.replace(nextWorker)");
  await expect(banner).toHaveCount(1); await expect(banner).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(banner).toContainText((lang === "ar" ? ar : en)["pwa.updateAvailable"]); expect(errors).toEqual([]);
});

test.describe("localized real production updates", () => {
  test.skip(!process.env.WESAL_PWA_PRODUCTION_URL, "Requires a local production frontend and mocked APIs; no backend.");
  let proxy: Awaited<ReturnType<typeof startPwaUpdateProxy>>;
  test.beforeAll(async ({}, info) => { proxy = await startPwaUpdateProxy(process.env.WESAL_PWA_PRODUCTION_URL!, info.project.use.baseURL as string); });
  test.afterAll(async () => { await proxy?.close(); });
  async function deployUpdate(page: Page) {
    await deployPwaUpdate(page, () => proxy.nextDeployment());
  }
  for (const width of [390, 768, 1366]) for (const lang of ["ar", "en"] as const)
    test(`${width}px ${lang}: live translation, booking modal and keyboard update`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(language => { if (!localStorage.getItem("wesal_ui_lang")) localStorage.setItem("wesal_ui_lang", language); }, lang);
      const state = await setupExternalBookings(page);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      const banner = page.getByTestId("pwa-update-banner"); await expect(banner).toHaveCount(0);
      await deployUpdate(page); await expect(banner).toHaveCount(1);
      await expect(banner).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(banner).toContainText((lang === "ar" ? ar : en)["pwa.updateAvailable"]);
      expect(await banner.evaluate(element => element.parentElement === document.body)).toBe(true);
      await page.evaluate("window.originalBanner=document.querySelector('[data-testid=pwa-update-banner]');window.originalController=navigator.serviceWorker.controller");
      const next = lang === "ar" ? "en" : "ar", catalog = next === "ar" ? ar : en;
      await page.locator('[data-testid="language-toggle"]:visible').first().click();
      await expect(banner).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr"); await expect(banner).toHaveAttribute("lang", next);
      await expect(banner).toContainText(catalog["pwa.updateAvailable"]);
      expect(await banner.evaluate(element => element === (window as unknown as { originalBanner: Element }).originalBanner)).toBe(true);
      expect(await page.evaluate("navigator.serviceWorker.controller===originalController")).toBe(true);
      const button = banner.getByRole("button", { name: catalog["pwa.updateAction"], exact: true });
      for (const element of [banner.locator("p"), button]) {
        const box = await element.boundingBox(); expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      const opener = page.getByTestId("owner-calendar-add-booking"); await opener.click();
      const modal = page.getByTestId("owner-add-booking-modal"); await expect(modal).toBeVisible();
      await expect(page.getByTestId("owner-add-booking-overlay")).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr");
      await modal.getByTestId("owner-add-booking-customer").fill("Localized update booking"); await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
      const save = modal.getByTestId("owner-add-booking-save"); await save.focus(); await page.keyboard.press("Tab");
      await expect(modal.getByTestId("owner-add-booking-close")).toBeFocused(); await page.keyboard.press("Shift+Tab"); await expect(save).toBeFocused();
      expect(await save.evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
      await save.click(); await expect(modal).toHaveCount(0); expect(state.submissions).toHaveLength(1); await expect(opener).toBeFocused();
      await button.focus(); await expect(button).toBeFocused();
      await Promise.all([page.waitForEvent("framenavigated", frame => frame === page.mainFrame()), page.keyboard.press("Enter")]);
      await expect(page.getByTestId("owner-bookings-calendar-page")).toBeVisible(); await expect(banner).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute("lang", next);
    });
});
