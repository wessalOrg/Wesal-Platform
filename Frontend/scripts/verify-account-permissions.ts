/**
 * Task 4 permission policy smoke checks.
 * Run: npx tsx scripts/verify-account-permissions.ts
 */
import assert from "node:assert/strict";
import { normalizeAccountApprovalStatus } from "../src/lib/account-approval";
import {
  canPerformAccountAction,
  canPublishProfessionalContent,
  canResubmitProfessionalSetup,
  shouldRedirectProfessionalToSetup,
  shouldShowPendingProfessionalProfile,
} from "../src/lib/account-permissions";
import { mapServerNotification } from "../src/lib/platform-notification-mapper";
import { mapProfileDto } from "../src/lib/profile-mapper";

function main() {
  assert.equal(normalizeAccountApprovalStatus("Pending"), "Pending");
  assert.equal(normalizeAccountApprovalStatus(1), "Pending");
  assert.equal(normalizeAccountApprovalStatus("Approved"), "Approved");
  assert.equal(normalizeAccountApprovalStatus("weird"), null);

  const pending = {
    authenticated: true,
    role: "EventCoordinator" as const,
    isSetupComplete: true,
    approvalStatus: "Pending",
  };
  assert.equal(canPublishProfessionalContent(pending), false);
  assert.equal(canPerformAccountAction("CreatePost", pending), false);
  assert.equal(canPerformAccountAction("CreateOffer", pending), false);
  assert.equal(canPerformAccountAction("MessageAdmin", pending), true);
  // Backend HallBookingAccess: professionals may book while Pending/Rejected/NeedsChanges.
  assert.equal(canPerformAccountAction("BookHall", pending), true);
  assert.equal(shouldShowPendingProfessionalProfile(pending), true);
  assert.equal(shouldRedirectProfessionalToSetup(pending), false);

  const loading = {
    authenticated: true,
    role: "Photographer" as const,
    statusLoading: true,
  };
  assert.equal(canPublishProfessionalContent(loading), false);
  assert.equal(canPerformAccountAction("MessageAdmin", loading), true);

  const needsSetup = {
    authenticated: true,
    role: "Photographer" as const,
    isSetupComplete: false,
    approvalStatus: "Pending",
  };
  assert.equal(shouldRedirectProfessionalToSetup(needsSetup), true);
  assert.equal(canPerformAccountAction("MessageAdmin", needsSetup), false);

  const approved = {
    authenticated: true,
    role: "EventCoordinator" as const,
    isSetupComplete: true,
    approvalStatus: "Approved",
  };
  assert.equal(canPublishProfessionalContent(approved), true);
  assert.equal(shouldShowPendingProfessionalProfile(approved), false);
  assert.equal(canResubmitProfessionalSetup(approved), false);

  const rejectedCoordinator = {
    authenticated: true,
    role: "EventCoordinator" as const,
    isSetupComplete: true,
    approvalStatus: "Rejected",
  };
  assert.equal(canResubmitProfessionalSetup(rejectedCoordinator), true);
  assert.equal(canPublishProfessionalContent(rejectedCoordinator), false);
  assert.equal(canPerformAccountAction("BookHall", rejectedCoordinator), true);

  assert.equal(
    canPerformAccountAction("BookHall", {
      authenticated: true,
      role: "HallOwner",
      isSetupComplete: true,
      approvalStatus: "Approved",
    }),
    false,
  );

  const needsChangesPhotographer = {
    authenticated: true,
    role: "Photographer" as const,
    isSetupComplete: true,
    approvalStatus: "NeedsChanges",
  };
  assert.equal(canResubmitProfessionalSetup(needsChangesPhotographer), true);

  const needsChangesCoordinator = {
    authenticated: true,
    role: "EventCoordinator" as const,
    isSetupComplete: true,
    approvalStatus: "NeedsChanges",
  };
  // Backend has no coordinator NeedsChanges workflow.
  assert.equal(canResubmitProfessionalSetup(needsChangesCoordinator), false);

  const rejectionNotice = mapServerNotification({
    kind: "CoordinatorRejectedForCoordinator",
    title: "تعذر قبول طلبك",
    body: 'تم رفض طلبك للسبب الاتي : "مستند الهوية غير واضح"',
    actionLabel: "فتح المحادثة مع الإدارة",
    targetId: "conv-99",
    actionTarget: "Conversation",
  });
  assert.ok(rejectionNotice);
  assert.equal(rejectionNotice?.type, "registration_rejected");
  assert.equal(rejectionNotice?.metadata.conversation_id, "conv-99");
  assert.match(rejectionNotice?.body ?? "", /مستند الهوية غير واضح/);

  const needsChangesNotice = mapServerNotification({
    kind: "PhotographerNeedsChangesForPhotographer",
    title: "طلبك يحتاج إلى تعديل",
    body: "توجد ملاحظات من الإدارة على بياناتك أو مستنداتك.",
    targetId: "conv-100",
    actionTarget: "Conversation",
  });
  assert.ok(needsChangesNotice);
  assert.equal(needsChangesNotice?.type, "registration_needs_changes");
  assert.equal(needsChangesNotice?.metadata.conversation_id, "conv-100");

  const profile = mapProfileDto({
    fullName: "Test",
    email: "t@wesal.ps",
    phoneNumber: "+970599000000",
    concurrencyStamp: "1",
    isSetupComplete: true,
    approvalStatus: "Pending",
  });
  assert.equal(profile.isSetupComplete, true);
  assert.equal(profile.approvalStatus, "Pending");

  console.log("verify-account-permissions: ok");
}

main();
