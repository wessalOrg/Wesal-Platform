/**
 * Task 7 — Admin Photographer Requests smoke checks.
 * Run: npx tsx scripts/verify-admin-photographers.ts
 */
import assert from "node:assert/strict";
import {
  canApprovePhotographer,
  canRejectPhotographer,
  canRequestChangesPhotographer,
  isAdminPhotographerFilter,
  mapAdminPhotographerConversation,
  mapAdminPhotographerDecision,
  mapAdminPhotographerRequestDetail,
  mapAdminPhotographerRequestPage,
} from "../src/lib/admin-photographers-mapper";
import {
  ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX,
  toRejectAdminPhotographerPayload,
  validateAdminPhotographerRejectReason,
} from "../src/lib/admin-reject-photographer";
import {
  ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX,
  toRequestChangesAdminPhotographerPayload,
  validateAdminPhotographerRequestChangesNotes,
} from "../src/lib/admin-request-changes-photographer";
import {
  ADMIN_PHOTOGRAPHERS_PATH,
  adminPhotographerMessagesPath,
  adminPhotographerRequestPath,
} from "../src/lib/account-profile-path";

assert.equal(isAdminPhotographerFilter("Pending"), true);
assert.equal(isAdminPhotographerFilter("NeedsChanges"), true);
assert.equal(isAdminPhotographerFilter("ChangesRequested"), false);

const studioPage = mapAdminPhotographerRequestPage({
  items: [
    {
      userId: "u-1",
      fullName: "Omar",
      email: "omar@wesal.ps",
      approvalStatus: "Pending",
      hasStudio: true,
      displayName: "استوديو نور",
      submittedAt: "2026-10-01T10:00:00Z",
    },
  ],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 1,
  totalPages: 1,
});
assert.equal(studioPage.items.length, 1);
assert.equal(studioPage.items[0]?.hasStudio, true);
assert.equal(studioPage.items[0]?.displayName, "استوديو نور");

const independentDetail = mapAdminPhotographerRequestDetail({
  userId: "u-2",
  fullName: "Lina",
  email: "lina@wesal.ps",
  userPhoneNumber: "0591234567",
  approvalStatus: "Pending",
  isSetupComplete: true,
  hasStudio: false,
  legalFullName: "لينا أحمد",
  setupPhoneNumber: "0599999999",
  submittedAt: "2026-10-01T10:00:00Z",
  identityDocumentUrl: "/api/v1/admin/photographers/u-2/identity-document",
});
assert.ok(independentDetail);
assert.equal(independentDetail?.hasStudio, false);
assert.equal(independentDetail?.legalFullName, "لينا أحمد");
assert.equal(independentDetail?.hasIdentityDocument, true);
assert.equal(independentDetail?.studioName, null);

const studioDetail = mapAdminPhotographerRequestDetail({
  userId: "u-1",
  fullName: "Omar",
  email: "omar@wesal.ps",
  approvalStatus: "NeedsChanges",
  isSetupComplete: true,
  hasStudio: true,
  studioName: "استوديو نور",
  studioLocation: "رام الله",
  detailedStudioLocation: "شارع الإرسال",
  setupPhoneNumber: "0591111111",
  submittedAt: "2026-10-01T10:00:00Z",
  identityDocumentUrl: "/api/v1/admin/photographers/u-1/identity-document",
});
assert.ok(studioDetail);
assert.equal(studioDetail?.hasStudio, true);
assert.equal(studioDetail?.legalFullName, null);
assert.equal(studioDetail?.studioLocation, "رام الله");
assert.equal(studioDetail?.approvalStatus, "NeedsChanges");

assert.equal(canApprovePhotographer("Pending"), true);
assert.equal(canApprovePhotographer("NeedsChanges"), false);
assert.equal(canRejectPhotographer("Pending"), true);
assert.equal(canRejectPhotographer("Rejected"), false);
assert.equal(canRequestChangesPhotographer("Pending"), true);
assert.equal(canRequestChangesPhotographer("NeedsChanges"), false);
assert.equal(canRequestChangesPhotographer("Approved"), false);

assert.equal(validateAdminPhotographerRejectReason("  "), "required");
assert.equal(
  validateAdminPhotographerRejectReason(
    "x".repeat(ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX + 1),
  ),
  "tooLong",
);
assert.deepEqual(toRejectAdminPhotographerPayload("  سبب  "), { reason: "سبب" });

assert.equal(validateAdminPhotographerRequestChangesNotes("  "), "required");
assert.equal(
  validateAdminPhotographerRequestChangesNotes(
    "x".repeat(ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX + 1),
  ),
  "tooLong",
);
assert.deepEqual(toRequestChangesAdminPhotographerPayload("  عدّل الهوية  "), {
  notes: "عدّل الهوية",
});

const decision = mapAdminPhotographerDecision({
  userId: "u-1",
  status: "NeedsChanges",
  notificationDelivered: true,
});
assert.equal(decision?.status, "NeedsChanges");

const conversation = mapAdminPhotographerConversation({
  conversationId: "c-9",
  userId: "u-1",
  isExisting: true,
});
assert.equal(conversation?.conversationId, "c-9");

assert.equal(adminPhotographerRequestPath("u-1"), `${ADMIN_PHOTOGRAPHERS_PATH}/u-1`);
{
  const expected = new URLSearchParams();
  expected.set("conversation_id", "c-9");
  expected.set("peer", "استوديو نور");
  assert.equal(
    adminPhotographerMessagesPath("c-9", "استوديو نور"),
    `/admin/messages?${expected.toString()}`,
  );
}

console.log("verify-admin-photographers: ok");
