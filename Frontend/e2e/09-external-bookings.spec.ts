import { expect, test } from "@playwright/test";
import { setupExternalBookings as setup, bookingId, secondHallId, legacy } from "./helpers/external-bookings-fixture";

test("external confirmed calendar cards use server IDs and preserve legacy storage", async ({ page }) => {
  const state = await setup(page, { existing: true });
  const day = page.getByTestId("owner-calendar-booked");
  await expect(day.getByTestId("owner-calendar-booking-card")).toHaveCount(1);
  await expect(day.getByTestId("owner-calendar-booking-card")).toHaveAttribute("data-booking-id", bookingId);
  await expect(day).toContainText("External Customer");
  await expect(page.getByText("LEGACY ONLY")).toHaveCount(0);
  await expect(page.getByTestId(`hall-cal-day-${state.date}`).getByTestId("owner-cal-booked-dot")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("wesal_owner_manual_bookings_v1"))).toBe(legacy);
});

test("lost create response retries the same key and shows success only after acknowledgement", async ({ page }) => {
  const state = await setup(page, { loseFirstResponse: true });
  await page.getByTestId("owner-calendar-add-booking").click();
  const modal = page.getByTestId("owner-add-booking-modal");
  await modal.getByTestId("owner-add-booking-customer").fill("External New");
  await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await expect(modal).toBeVisible();
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal).toHaveCount(0);
  expect(state.rows).toHaveLength(1); expect(state.keys).toHaveLength(2); expect(state.keys[0]).toBe(state.keys[1]);
  expect(await page.evaluate(() => localStorage.getItem("wesal_owner_manual_bookings_v1"))).toBe(legacy);
});

test("expired subscription still permits external details editing and cancellation", async ({ page }) => {
  const state = await setup(page, { existing: true, expired: true });
  const day = page.getByTestId("owner-calendar-booked");
  await expect(day.getByTestId("external-booking-actions")).toBeVisible();
  await day.getByTestId("external-booking-actions").getByRole("button").first().click();
  const modal = page.getByTestId("owner-add-booking-modal"); await expect(modal).toBeVisible();
  await modal.getByTestId("owner-add-booking-notes").fill("Updated outside platform");
  await modal.getByTestId("owner-add-booking-save").click(); await expect(modal).toHaveCount(0);
  expect(state.rows[0].notes).toBe("Updated outside platform"); expect(state.revisions[0]).toBe('"1"');
  await day.getByTestId("external-booking-actions").getByRole("button").nth(1).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await dialog.getByRole("button").first().click(); await expect(dialog).toHaveCount(0);
  expect(state.rows[0].status).toBe("Cancelled"); expect(state.revisions[1]).toBe('"2"');
  await expect(page.getByTestId(`hall-cal-day-${state.date}`).getByTestId("owner-cal-booked-dot")).toHaveCount(0);
});

for (const ambiguous5xx of [false, true]) test(`uncertain create survives close/reopen and Hall switch (${ambiguous5xx ? "503" : "lost response"})`, async ({ page }) => {
  const state = await setup(page, { loseFirstResponse: !ambiguous5xx, ambiguous5xx, twoHalls: true });
  await page.getByTestId("owner-calendar-add-booking").click();
  const modal = page.getByTestId("owner-add-booking-modal");
  await modal.getByTestId("owner-add-booking-customer").fill("Original Draft");
  await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
  await modal.getByTestId("owner-add-booking-notes").fill("Keep these exact details");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(page.getByTestId("owner-booking-recovery")).toBeVisible();
  await modal.getByTestId("owner-add-booking-close").click();
  await page.getByTestId("owner-calendar-hall-select").click();
  await page.getByTestId("owner-calendar-hall-menu").getByRole("option").nth(1).click();
  await expect(page).toHaveURL(new RegExp(secondHallId));
  await page.getByTestId("owner-calendar-add-booking").click();
  await expect(modal.getByTestId("owner-add-booking-customer")).toHaveValue("Original Draft");
  await expect(modal.getByTestId("owner-add-booking-notes")).toHaveValue("Keep these exact details");
  await expect(modal.getByTestId("owner-add-booking-customer")).toBeDisabled();
  await expect(page.getByTestId("owner-booking-recovery")).toContainText("Contract Hall");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal).toHaveCount(0);
  expect(state.keys).toHaveLength(2); expect(state.keys[0]).toBe(state.keys[1]);
  expect(state.submissions[0]).toEqual(state.submissions[1]); expect(state.rows).toHaveLength(1);
  await page.getByTestId("owner-calendar-add-booking").click();
  await expect(page.getByTestId("owner-booking-recovery")).toHaveCount(0);
  await expect(modal.getByTestId("owner-add-booking-customer")).toBeEnabled();
  await modal.getByTestId("owner-add-booking-customer").fill("Fresh Draft");
  await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal).toHaveCount(0); expect(state.keys[2]).not.toBe(state.keys[0]);
});

test("a definitive rejection resolves an uncertain create and allows corrected input", async ({ page }) => {
  const state = await setup(page, { loseFirstResponse: true, rejectRetry: true });
  await page.getByTestId("owner-calendar-add-booking").click();
  const modal = page.getByTestId("owner-add-booking-modal");
  await modal.getByTestId("owner-add-booking-customer").fill("Original Draft");
  await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(page.getByTestId("owner-booking-recovery")).toBeVisible();
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(page.getByTestId("owner-booking-recovery")).toHaveCount(0);
  await modal.getByTestId("owner-add-booking-customer").fill("Corrected Draft");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal).toHaveCount(0);
  expect(state.keys[0]).toBe(state.keys[1]); expect(state.keys[2]).not.toBe(state.keys[0]);
});

test("disjoint intervals render accurately and remain disjoint during metadata edits and rescheduling", async ({ page }) => {
  const state = await setup(page, { existing: true, disjoint: true });
  const day = page.getByTestId("owner-calendar-booked");
  // Assert both intervals using the actual formatted labels in the current UI language.
  const card = day.getByTestId("owner-calendar-booking-card");
  await expect(card).toContainText("10:00"); await expect(card).toContainText("11:00");
  await expect(card).toContainText("12:00"); await expect(card).toContainText("1:00");
  await expect(card).toContainText(/[,،]/);
  await day.getByTestId("external-booking-actions").getByRole("button").first().click();
  const modal = page.getByTestId("owner-add-booking-modal");
  await expect(modal.getByTestId("owner-edit-booking-range-from-0")).toContainText("10:00");
  await expect(modal.getByTestId("owner-edit-booking-range-to-0")).toContainText("11:00");
  await expect(modal.getByTestId("owner-edit-booking-range-from-1")).toContainText("12:00");
  await expect(modal.getByTestId("owner-edit-booking-range-to-1")).toContainText("1:00");
  await modal.getByTestId("owner-add-booking-notes").fill("Keep the gap");
  await modal.getByTestId("owner-add-booking-save").click(); await expect(modal).toHaveCount(0);
  expect(state.rows[0].slotStarts).toEqual(["10:00:00", "12:00:00"]);
  await day.getByTestId("external-booking-actions").getByRole("button").first().click();
  await modal.getByTestId("owner-edit-booking-range-from-1").click();
  await page.getByTestId("owner-edit-booking-range-from-1-menu").getByRole("option").nth(14).click();
  await modal.getByTestId("owner-edit-booking-range-to-1").click();
  await page.getByTestId("owner-edit-booking-range-to-1-menu").getByRole("option").nth(15).click();
  await modal.getByTestId("owner-add-booking-save").click(); await expect(modal).toHaveCount(0);
  expect(state.rows[0].slotStarts).toEqual(["10:00:00", "14:00:00"]);
});
