/**
 * Task 6 — Admin Coordinator Requests smoke checks.
 * Run: npx tsx scripts/verify-admin-coordinators.ts
 */
import assert from "node:assert/strict";
import {
  canApproveCoordinator,
  canRejectCoordinator,
  isAdminCoordinatorFilter,
  mapAdminCoordinatorConversation,
  mapAdminCoordinatorDecision,
  mapAdminCoordinatorRequestDetail,
  mapAdminCoordinatorRequestPage,
} from "../src/lib/admin-coordinators-mapper";
import {
  ADMIN_COORDINATOR_REJECT_REASON_MAX,
  toRejectAdminCoordinatorPayload,
  validateAdminCoordinatorRejectReason,
} from "../src/lib/admin-reject-coordinator";
import {
  ADMIN_COORDINATORS_PATH,
  adminCoordinatorMessagesPath,
  adminCoordinatorRequestPath,
} from "../src/lib/account-profile-path";

assert.equal(isAdminCoordinatorFilter("Pending"), true);
assert.equal(isAdminCoordinatorFilter("NeedsChanges"), false);

const page = mapAdminCoordinatorRequestPage({
  items: [
    {
      userId: "u-1",
      fullName: "Sara",
      email: "sara@wesal.ps",
      approvalStatus: "Pending",
      businessType: "Shop",
      displayName: "وردة",
      submittedAt: "2026-10-01T10:00:00Z",
    },
  ],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 1,
  totalPages: 1,
});
assert.equal(page.items.length, 1);
assert.equal(page.items[0]?.businessType, "Shop");
assert.equal(page.items[0]?.approvalStatus, "Pending");

const detail = mapAdminCoordinatorRequestDetail({
  userId: "u-1",
  fullName: "Sara",
  email: "sara@wesal.ps",
  userPhoneNumber: "0591234567",
  approvalStatus: "Pending",
  isSetupComplete: true,
  businessType: "Freelance",
  onlineStoreName: "لمسة",
  setupPhoneNumber: "0599999999",
  submittedAt: "2026-10-01T10:00:00Z",
  identityDocumentUrl: "/api/v1/admin/coordinators/u-1/identity-document",
  workPhoto1Url: "/api/v1/admin/coordinators/u-1/work-photos/1",
  workPhoto2Url: "/api/v1/admin/coordinators/u-1/work-photos/2",
});
assert.ok(detail);
assert.equal(detail?.businessType, "Freelance");
assert.equal(detail?.hasIdentityDocument, true);
assert.equal(detail?.hasShopPhoto, false);
assert.equal(detail?.hasWorkPhoto1, true);
assert.equal(detail?.hasWorkPhoto2, true);

assert.equal(canApproveCoordinator("Pending"), true);
assert.equal(canApproveCoordinator("Approved"), false);
assert.equal(canRejectCoordinator("Pending"), true);
assert.equal(canRejectCoordinator("Rejected"), false);

assert.equal(validateAdminCoordinatorRejectReason("  "), "required");
assert.equal(
  validateAdminCoordinatorRejectReason("x".repeat(ADMIN_COORDINATOR_REJECT_REASON_MAX + 1)),
  "tooLong",
);
assert.equal(validateAdminCoordinatorRejectReason("مستند غير واضح"), null);
assert.deepEqual(toRejectAdminCoordinatorPayload("  سبب  "), { reason: "سبب" });

const decision = mapAdminCoordinatorDecision({
  userId: "u-1",
  status: "Approved",
  notificationDelivered: true,
});
assert.equal(decision?.status, "Approved");

const conversation = mapAdminCoordinatorConversation({
  conversationId: "c-9",
  userId: "u-1",
  isExisting: true,
});
assert.equal(conversation?.conversationId, "c-9");

assert.equal(adminCoordinatorRequestPath("u-1"), `${ADMIN_COORDINATORS_PATH}/u-1`);
assert.equal(
  adminCoordinatorMessagesPath("c-9", "وردة"),
  "/admin/messages?conversation_id=c-9&peer=%D9%88%D8%B1%D8%AF%D8%A9",
);

console.log("verify-admin-coordinators: ok");
