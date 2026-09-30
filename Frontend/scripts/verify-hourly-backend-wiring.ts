/**
 * Edit 1 — day + hourly slot booking is wired to WESAL-TASK-1 APIs.
 * Run: npx tsx scripts/verify-hourly-backend-wiring.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatHourlyRange, normalizeTimeOnly } from "../src/lib/hourly-slots";
import { isGuidHallId } from "../src/services/hourly-bookings";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function testTimeMapping() {
  assert.equal(normalizeTimeOnly("09:00:00"), "09:00");
  assert.equal(normalizeTimeOnly("10:00"), "10:00");
  assert.equal(formatHourlyRange("08:00", "09:00", "en-US"), "08:00 AM – 09:00 AM");
  assert.equal(formatHourlyRange("11:00", "12:00", "en-US"), "11:00 AM – 12:00 PM");
  console.log("ok  TimeOnly + hourly table labels");
}

function testGuidGate() {
  assert.equal(isGuidHallId("1"), false);
  assert.equal(isGuidHallId("demo-hall-approved"), false);
  assert.equal(isGuidHallId("8f14e45f-ea9c-4b1c-9d2a-6b7c8d9e0f11"), true);
  console.log("ok  live API is GUID-only; stub/demo hall ids stay local");
}

function testServiceContract() {
  const service = read("src/services/hourly-bookings.ts");
  assert.match(service, /\/halls\/\$\{hallId\}\/availability-calendar/);
  assert.match(service, /\/halls\/\$\{hallId\}\/hourly-catalog/);
  assert.match(service, /\/halls\/\$\{input\.hallId\}\/hourly-bookings/);
  assert.match(service, /nameOnBooking/);
  assert.match(service, /requesterName/);
  assert.match(service, /slotStarts:\s*\[toSlotStartPayload/);
  assert.doesNotMatch(service, /slotStart:/);
  assert.match(service, /\/owner\/halls\/\$\{input\.hallId\}\/day-block/);
  assert.match(service, /isOpen: !input\.blocked/);
  assert.match(service, /\/owner\/halls\/\$\{hallId\}\/hourly-settings/);
  assert.match(service, /showBookedSlots/);
  assert.doesNotMatch(service, /\/bookings\/hourly/);
  assert.doesNotMatch(service, /\/block-day/);
  assert.doesNotMatch(service, /booking-visibility/);
  console.log("ok  hourly service uses WESAL-TASK-1 paths");
}

function testSeekerUiReplaced() {
  const details = read("src/components/halls/HallDetailsPage.tsx");
  const view = read("src/components/halls/HallDetailsView.tsx");
  const card = read("src/components/halls/CatalogHallCard.tsx");
  const settings = read("src/components/owner-management/halls/HallManagementForm.tsx");
  const register = read("src/components/owner-management/add-hall/HallRegistrationForm.tsx");
  assert.match(details, /HallHourlyBookingSection/);
  assert.match(details, /showCalendar/);
  assert.doesNotMatch(details, /HallBookingPanel/);
  assert.doesNotMatch(details, /HallInlineBookingSection/);
  assert.doesNotMatch(details, /BookingPeriodsSection/);
  assert.match(view, /HallHourlyBookingSection/);
  assert.doesNotMatch(view, /HallHourlyBookingModal/);
  assert.match(card, /buildHallDetailsPath\(hall\.id, true\)/);
  assert.match(settings, /OwnerHourlyControls/);
  assert.match(settings, /owner-show-booked-toggle|owner\.hourly/);
  assert.doesNotMatch(settings, /BookingPeriodsSection/);
  assert.doesNotMatch(register, /BookingPeriodsSection/);
  console.log("ok  seeker UI is calendar + hourly slots; owner settings have block/toggle");
}

testTimeMapping();
testGuidGate();
testServiceContract();
testSeekerUiReplaced();
console.log("hourly backend wiring checks passed");
