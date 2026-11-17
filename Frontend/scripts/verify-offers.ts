/**
 * Task 10 — Offers validation + lifecycle smoke checks.
 * Run: npx tsx scripts/verify-offers.ts
 */
import assert from "node:assert/strict";
import {
  OFFER_CONTENT_MAX,
  OFFER_MAX_MONEY,
  calculateOfferDiscountPercent,
  canStopOffer,
  datetimeLocalToIso,
  deriveOfferLifecycleStatus,
  parseOfferMoney,
  parseOptionalOfferMoney,
  validateOfferDateRange,
  validateOfferPricePair,
} from "../src/lib/offer-validation";
import {
  isOwnerHallOffersPath,
  ownerHallOffersPath,
  parseOwnerHallIdFromPathname,
} from "../src/lib/hall-owner-query-keys";
import { mapHallOffer } from "../src/lib/hall-offers-mapper";

assert.deepEqual(parseOfferMoney("1200.5"), { value: 1200.5, issue: null });
assert.equal(parseOfferMoney("").issue, "required");
assert.equal(parseOfferMoney("0").issue, "nonPositive");
assert.equal(parseOfferMoney("12.555").issue, "invalid");
assert.equal(parseOfferMoney(String(OFFER_MAX_MONEY + 1)).issue, "tooLarge");

assert.deepEqual(parseOptionalOfferMoney(""), { value: null, issue: null });
assert.deepEqual(parseOptionalOfferMoney("0"), { value: 0, issue: null });
assert.equal(parseOptionalOfferMoney("-1").issue, "invalid");
assert.equal(parseOptionalOfferMoney("abc").issue, "invalid");

assert.equal(validateOfferPricePair(100, 80), null);
assert.equal(validateOfferPricePair(100, 100), "offerNotLower");
assert.equal(validateOfferPricePair(100, 120), "offerNotLower");

assert.equal(calculateOfferDiscountPercent(1000, 800), 20);
assert.equal(calculateOfferDiscountPercent(0, 10), null);
assert.equal(calculateOfferDiscountPercent(100, 100), null);

const now = new Date("2026-06-15T12:00:00.000Z");
const futureStart = "2026-06-20T10:00";
const futureEnd = "2026-06-25T10:00";
const dates = validateOfferDateRange(futureStart, futureEnd, now);
assert.equal(dates.issue, null);
assert.ok(dates.startsAt);
assert.ok(dates.endsAt);

assert.equal(
  validateOfferDateRange(futureEnd, futureStart, now).issue,
  "endBeforeStart",
);
assert.equal(
  validateOfferDateRange("2026-06-10T10:00", "2026-06-14T10:00", now).issue,
  "endNotFuture",
);

assert.ok(datetimeLocalToIso("2026-06-20T10:00"));
assert.equal(datetimeLocalToIso(""), null);

assert.equal(
  deriveOfferLifecycleStatus({
    startsAt: "2026-06-10T00:00:00.000Z",
    endsAt: "2026-06-20T00:00:00.000Z",
    stoppedAt: null,
    now,
  }),
  "active",
);
assert.equal(
  deriveOfferLifecycleStatus({
    startsAt: "2026-06-20T00:00:00.000Z",
    endsAt: "2026-06-25T00:00:00.000Z",
    stoppedAt: null,
    now,
  }),
  "scheduled",
);
assert.equal(
  deriveOfferLifecycleStatus({
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-06-10T00:00:00.000Z",
    stoppedAt: null,
    now,
  }),
  "expired",
);
assert.equal(
  deriveOfferLifecycleStatus({
    startsAt: "2026-06-10T00:00:00.000Z",
    endsAt: "2026-06-20T00:00:00.000Z",
    stoppedAt: "2026-06-14T00:00:00.000Z",
    now,
  }),
  "stopped",
);

assert.equal(canStopOffer("active"), true);
assert.equal(canStopOffer("scheduled"), true);
assert.equal(canStopOffer("expired"), false);
assert.equal(canStopOffer("stopped"), false);

assert.ok(OFFER_CONTENT_MAX >= 2000);

const hallOffer = mapHallOffer({
  id: "11111111-1111-1111-1111-111111111111",
  hallId: "22222222-2222-2222-2222-222222222222",
  hallName: "قاعة الاختبار",
  oldBookingPrice: 3000,
  offerPrice: 2400,
  startsAt: "2026-06-10T00:00:00.000Z",
  endsAt: "2026-06-20T00:00:00.000Z",
  stoppedAt: null,
});
assert.ok(hallOffer);
assert.equal(hallOffer?.offerPrice, 2400);
assert.equal(mapHallOffer(null), null);

assert.equal(
  ownerHallOffersPath("abc-123"),
  "/owner/halls/abc-123/offers",
);
assert.equal(isOwnerHallOffersPath("/owner/halls/abc-123/offers"), true);
assert.equal(isOwnerHallOffersPath("/owner/halls/abc-123/notifications"), false);
assert.equal(
  parseOwnerHallIdFromPathname("/owner/halls/abc-123/offers"),
  "abc-123",
);

console.log("verify-offers: ok");
