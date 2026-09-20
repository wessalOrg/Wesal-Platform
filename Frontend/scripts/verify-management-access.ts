/**
 * Verification for US-ADMIN-07 management access until payment is confirmed.
 * Run: npx tsx scripts/verify-management-access.ts
 */
import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api-error";
import {
  canAccessBookingData,
  canAccessCalendar,
  canAccessDashboard,
  canAccessMessaging,
  getManagementAccess,
  hallAccessFromFlags,
  hallAccessFromHall,
  hallAccessFromUnknown,
} from "../src/lib/hall-access";
import {
  PAYMENT_STATUS,
  parsePaymentStatus,
  readPaymentStatus,
} from "../src/lib/hall-payment-status";
import { mapHallOwnerHallDto } from "../src/lib/hall-owner-halls-mapper";
import { isPaymentRequiredApiError } from "../src/lib/payment-required-error";
import { isSystemLockedApiError } from "../src/lib/system-locked-error";

function access(input: {
  status?: "Pending" | "Approved" | "Rejected";
  paymentStatus?: "Unpaid" | "Paid";
  adminLocked?: boolean;
  systemLocked?: boolean;
}) {
  return hallAccessFromHall({
    status: input.status ?? "Approved",
    paymentStatus: input.paymentStatus ?? "Paid",
    adminLocked: input.adminLocked ?? false,
    systemLocked: input.systemLocked ?? false,
  });
}

function testIndependence() {
  const approvedUnpaid = hallAccessFromUnknown({
    status: "Approved",
    paymentStatus: "Unpaid",
    adminLocked: false,
    systemLocked: false,
  });
  assert.equal(approvedUnpaid.hallStatus, "Approved");
  assert.equal(approvedUnpaid.paymentStatus, "Unpaid");
  assert.equal(approvedUnpaid.adminLocked, false);
  assert.equal(approvedUnpaid.systemLocked, false);

  const approvedNoPaymentField = hallAccessFromUnknown({
    status: "Approved",
    adminLocked: false,
    systemLocked: false,
  });
  assert.equal(approvedNoPaymentField.hallStatus, "Approved");
  assert.equal(approvedNoPaymentField.paymentStatus, "Unpaid");

  const paidDoesNotChangeStatus = hallAccessFromUnknown({
    status: "PendingReview",
    paymentStatus: "Paid",
  });
  assert.equal(paidDoesNotChangeStatus.hallStatus, "Pending");
  assert.equal(paidDoesNotChangeStatus.paymentStatus, "Paid");

  assert.equal(parsePaymentStatus("Paid"), PAYMENT_STATUS.Paid);
  assert.equal(parsePaymentStatus("Unpaid"), PAYMENT_STATUS.Unpaid);
  assert.equal(parsePaymentStatus(true), PAYMENT_STATUS.Paid);
  assert.equal(parsePaymentStatus(false), PAYMENT_STATUS.Unpaid);
  assert.equal(readPaymentStatus({ isPaid: true, status: "Pending" }), "Paid");
  console.log("ok  payment independent from hall/lock status");
}

function testManagementPolicy() {
  const approvedUnpaid = access({ status: "Approved", paymentStatus: "Unpaid" });
  assert.deepEqual(getManagementAccess(approvedUnpaid), {
    allowed: false,
    reason: "PAYMENT_REQUIRED",
  });
  assert.equal(canAccessDashboard(approvedUnpaid), false);
  assert.equal(canAccessCalendar(approvedUnpaid), false);
  assert.equal(canAccessBookingData(approvedUnpaid), false);
  assert.equal(canAccessMessaging(approvedUnpaid), false);

  const paidAdmin = access({ paymentStatus: "Paid", adminLocked: true });
  assert.deepEqual(getManagementAccess(paidAdmin), {
    allowed: false,
    reason: "ADMIN_LOCKED",
  });

  const paidSystem = access({ paymentStatus: "Paid", systemLocked: true });
  assert.deepEqual(getManagementAccess(paidSystem), {
    allowed: false,
    reason: "SYSTEM_LOCKED",
  });

  const unpaidSystem = access({
    status: "Approved",
    paymentStatus: "Unpaid",
    systemLocked: true,
  });
  assert.deepEqual(getManagementAccess(unpaidSystem), {
    allowed: false,
    reason: "SYSTEM_LOCKED",
  });

  const bothLocks = access({ adminLocked: true, systemLocked: true });
  assert.deepEqual(getManagementAccess(bothLocks), {
    allowed: false,
    reason: "ADMIN_AND_SYSTEM_LOCKED",
  });
  assert.equal(bothLocks.adminLocked, true);
  assert.equal(bothLocks.systemLocked, true);
  assert.equal(bothLocks.hallStatus, "Approved");
  assert.equal(bothLocks.paymentStatus, "Paid");

  const paidOpen = access({ paymentStatus: "Paid" });
  assert.deepEqual(getManagementAccess(paidOpen), { allowed: true });

  const unpaidAndAdmin = access({
    status: "Approved",
    paymentStatus: "Unpaid",
    adminLocked: true,
  });
  assert.deepEqual(getManagementAccess(unpaidAndAdmin), {
    allowed: false,
    reason: "PAYMENT_REQUIRED",
  });

  const pendingUnpaid = access({ status: "Pending", paymentStatus: "Unpaid" });
  assert.deepEqual(getManagementAccess(pendingUnpaid), { allowed: true });

  const lockOnly = hallAccessFromFlags(false, false);
  assert.deepEqual(getManagementAccess(lockOnly), { allowed: true });
  console.log("ok  management access policy");
}

function testOwnerMapperPayment() {
  const unpaid = mapHallOwnerHallDto({
    id: "h1",
    name: "Hall",
    status: "Approved",
    paymentStatus: "Unpaid",
  });
  assert.ok(unpaid);
  assert.equal(unpaid?.status, "Approved");
  assert.equal(unpaid?.paymentStatus, "Unpaid");
  assert.equal(unpaid?.adminLocked, false);

  const paidFlag = mapHallOwnerHallDto({
    id: "h2",
    name: "Hall",
    status: "Approved",
    isPaid: true,
    adminLocked: true,
  });
  assert.equal(paidFlag?.paymentStatus, "Paid");
  assert.equal(paidFlag?.adminLocked, true);
  console.log("ok  owner mapper payment status");
}

function testPaymentRequiredError() {
  assert.equal(
    isPaymentRequiredApiError(new ApiError("nope", 403, {}, { code: "PaymentRequired" })),
    true,
  );
  assert.equal(isPaymentRequiredApiError(new ApiError("Payment required", 402)), true);
  assert.equal(
    isPaymentRequiredApiError(new ApiError("Hall is admin locked", 403, {}, { code: "Forbidden" })),
    false,
  );
  assert.equal(isPaymentRequiredApiError(new ApiError("not found", 404)), false);
  assert.equal(isPaymentRequiredApiError(new ApiError("conflict", 409)), false);
  console.log("ok  payment-required error mapping");
}

function testSystemLockedError() {
  assert.equal(
    isSystemLockedApiError(new ApiError("denied", 403, {}, { code: "SystemLocked" })),
    true,
  );
  assert.equal(
    isSystemLockedApiError(new ApiError("Subscription cycle ended", 403)),
    true,
  );
  assert.equal(isSystemLockedApiError(new ApiError("Payment required", 402)), false);
  assert.equal(
    isSystemLockedApiError(new ApiError("Hall is admin locked", 403, {}, { code: "Forbidden" })),
    false,
  );
  assert.equal(isSystemLockedApiError(new ApiError("generic forbidden", 403)), false);
  console.log("ok  system-locked error mapping");
}

testIndependence();
testManagementPolicy();
testOwnerMapperPayment();
testPaymentRequiredError();
testSystemLockedError();

console.log("\nAll management-access verifications passed.");
