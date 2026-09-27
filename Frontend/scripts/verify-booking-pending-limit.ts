/**
 * E10-LIL-01 / US-BOOK-03 — pending booking-request cap feedback.
 * Run: npx tsx scripts/verify-booking-pending-limit.ts
 */
import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api-error";
import { BookingError, bookingMessageKey, toBookingError } from "../src/lib/booking-errors";
import {
  isPendingLimitErrorKey,
  isPendingLimitReachedApiError,
  MAX_PENDING_BOOKING_REQUESTS,
  PENDING_LIMIT_ERROR_CODE,
  PENDING_LIMIT_MESSAGE_KEY,
} from "../src/lib/booking-pending-limit";
import { SEEKER_BOOKINGS_PATH } from "../src/constants/seekerDashboardNav";
import en from "../src/i18n/messages/en";
import {
  mockCancelBookingRequest,
  mockFetchMyBookings,
  mockSubmitBookingRequest,
} from "../src/services/bookings-mock";
import { submitBookingRequest } from "../src/services/bookings";

const EXPECTED_EN =
  "You already have 3 pending booking requests. Please wait for them to be resolved or manage your current requests.";

function pendingIds(bookings: { bookingId: string; status: string }[]) {
  return bookings
    .filter((item) => item.status === "Pending")
    .map((item) => item.bookingId)
    .sort();
}

function testCopyAndRouting() {
  assert.equal(en[PENDING_LIMIT_MESSAGE_KEY], EXPECTED_EN);
  assert.equal(en["halls.booking.pendingLimitCta"], "My Pending Bookings");
  assert.equal(SEEKER_BOOKINGS_PATH, "/profile/bookings");
  assert.equal(MAX_PENDING_BOOKING_REQUESTS, 3);
  console.log("ok  pending-limit copy and pending-bookings route");
}

function testErrorMapping() {
  const fromCode = toBookingError(
    new ApiError("Limit", 422, {}, { code: PENDING_LIMIT_ERROR_CODE }),
  );
  assert.equal(fromCode.kind, "pending_limit");
  assert.equal(fromCode.message, PENDING_LIMIT_MESSAGE_KEY);
  assert.equal(bookingMessageKey(fromCode.kind), PENDING_LIMIT_MESSAGE_KEY);
  assert.equal(isPendingLimitErrorKey(fromCode.message), true);
  assert.equal(isPendingLimitReachedApiError(fromCode), true);

  const from400 = toBookingError(
    new ApiError("Limit", 400, {}, { code: "pending_limit_reached" }),
  );
  assert.equal(from400.kind, "pending_limit");

  const fromExtensions = toBookingError(
    new ApiError("Limit", 422, {}, { details: { extensions: { code: "PENDING_LIMIT_REACHED" } } }),
  );
  assert.equal(fromExtensions.kind, "pending_limit");

  const validation = toBookingError(
    new ApiError("Validation failed", 400, { Date: ["The booking date must be in the future."] }, {
      code: "ValidationError",
      details: { errors: { Date: ["The booking date must be in the future."] } },
    }),
  );
  assert.equal(validation.kind, "validation");
  assert.equal(validation.message, "errors.booking.validation");
  assert.equal(isPendingLimitReachedApiError(validation), false);

  const conflict = toBookingError(
    new ApiError("The FirstPeriod period is no longer available", 409, {}, { code: "Conflict" }),
  );
  assert.equal(conflict.kind, "conflict");
  assert.equal(conflict.message, "errors.booking.conflict");
  assert.equal(isPendingLimitReachedApiError(conflict), false);

  const generic422 = toBookingError(new ApiError("Unprocessable", 422, {}, { code: "BusinessRule" }));
  assert.notEqual(generic422.kind, "pending_limit");

  console.log("ok  pending-limit mapping keeps validation/conflict distinct");
}

async function testMockConflictStaysDistinct() {
  await mockCancelBookingRequest("1", "mock-pending-1");
  const first = await mockSubmitBookingRequest({
    hallId: "8",
    date: "2026-11-01",
    periods: ["FirstPeriod"],
  });
  assert.equal(first.status, "Pending");

  const before = pendingIds(await mockFetchMyBookings());
  await assert.rejects(
    () =>
      mockSubmitBookingRequest({
        hallId: "8",
        date: "2026-11-01",
        periods: ["FirstPeriod"],
      }),
    (err: unknown) => {
      assert.ok(err instanceof BookingError);
      assert.equal(err.kind, "conflict");
      return true;
    },
  );
  const after = pendingIds(await mockFetchMyBookings());
  assert.deepEqual(after, before);
  console.log("ok  slot conflict remains distinct and does not duplicate state");
}

async function testFourthPendingRejectedWithoutState() {
  const beforeFill = pendingIds(await mockFetchMyBookings());
  if (beforeFill.length < MAX_PENDING_BOOKING_REQUESTS) {
    await mockSubmitBookingRequest({
      hallId: "9",
      date: "2026-12-01",
      periods: ["FirstPeriod"],
    });
  }

  const atCap = pendingIds(await mockFetchMyBookings());
  assert.equal(atCap.length, MAX_PENDING_BOOKING_REQUESTS);

  await assert.rejects(
    () =>
      submitBookingRequest({
        hallId: "9",
        date: "2026-12-15",
        periods: ["SecondPeriod"],
      }),
    (err: unknown) => {
      const mapped = toBookingError(err);
      assert.equal(mapped.kind, "pending_limit");
      assert.equal(mapped.message, PENDING_LIMIT_MESSAGE_KEY);
      assert.equal(en[mapped.message], EXPECTED_EN);
      return true;
    },
  );

  const after = pendingIds(await mockFetchMyBookings());
  assert.deepEqual(after, atCap);
  console.log("ok  4th pending submission shows limit error and creates no booking");
}

async function main() {
  testCopyAndRouting();
  testErrorMapping();
  await testMockConflictStaysDistinct();
  await testFourthPendingRejectedWithoutState();
  console.log("verify-booking-pending-limit: all checks passed");
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
