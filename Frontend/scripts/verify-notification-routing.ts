/**
 * Lightweight verification for Edit 13 notification routing.
 * Run: npx tsx scripts/verify-notification-routing.ts
 */
import assert from "node:assert/strict";
import { adminHallSubmissionPath } from "../src/lib/account-profile-path";
import { seekerBookingContactPath } from "../src/constants/seekerDashboardNav";
import { resolveNotificationActionUrl } from "../src/lib/platform-notification-routes";
import {
  ownerAdminMessagesPath,
  ownerHallNotificationsPath,
  ownerHallPaymentPath,
} from "../src/lib/hall-owner-query-keys";

assert.equal(resolveNotificationActionUrl("welcome"), "/halls");
assert.equal(resolveNotificationActionUrl("booking_submitted"), "/profile/bookings");
assert.equal(
  resolveNotificationActionUrl("booking_accepted", { booking_id: "b-1" }),
  seekerBookingContactPath("b-1"),
);
assert.equal(
  resolveNotificationActionUrl("booking_rejected", { booking_id: "b-2" }),
  seekerBookingContactPath("b-2"),
);
assert.equal(
  resolveNotificationActionUrl("booking_cancelled", {
    hall_id: "h-1",
    booking_id: "b-3",
  }),
  ownerHallNotificationsPath("h-1", "b-3"),
);
assert.equal(resolveNotificationActionUrl("hall_submitted"), "/owner/halls");
assert.equal(
  resolveNotificationActionUrl("hall_approved", { hall_id: "h-9" }),
  ownerHallPaymentPath("h-9"),
);
assert.equal(
  resolveNotificationActionUrl("hall_rejected", { hall_id: "h-9" }),
  ownerAdminMessagesPath("h-9"),
);
assert.equal(
  resolveNotificationActionUrl("hall_review_request", { hall_id: "h-4" }),
  adminHallSubmissionPath("h-4"),
);
assert.notEqual(
  resolveNotificationActionUrl("hall_review_request", { hall_id: "h-4" }),
  "/admin/hall-requests/h-4",
);
assert.equal(
  resolveNotificationActionUrl("welcome", {}, "/custom"),
  "/custom",
);

console.log("verify-notification-routing: ok");
