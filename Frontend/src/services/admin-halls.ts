import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAdminHallApproval,
  mapAdminHallDetail,
  mapAdminHallLock,
  mapAdminHallPage,
  mapAdminHallReject,
  mapAdminHallUnlock,
  mapAdminMarkPaid,
  mapAdminOwnerMessage,
  mapAdminPendingHalls,
  mapAdminSubscriptionOverview,
  type AdminHallPage,
} from "@/lib/admin-halls-mapper";
import { toRejectAdminHallPayload, validateAdminRejectReason } from "@/lib/admin-reject-hall";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type {
  AdminHallApprovalResult,
  AdminHallDetail,
  AdminHallLockResult,
  AdminHallRejectResult,
  AdminHallUnlockResult,
  AdminMarkPaidResult,
  AdminOwnerMessageResult,
  AdminPendingHall,
  AdminRejectHallRequest,
  AdminSubscriptionOwnerGroup,
} from "@/types/admin-halls";

function usesDemoAdminStub(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return Boolean(token?.startsWith("stub-admin"));
}

const DEMO_PENDING_HALLS: AdminPendingHall[] = [];

function buildDemoAdminHallDetail(hallId: string): AdminHallDetail {
  const pending = DEMO_PENDING_HALLS.find((hall) => hall.hallId === hallId);
  const isPending = hallId === "demo-hall-pending" || !pending;
  return {
    hallId,
    name: pending?.name ?? "",
    regionDisplayName: "",
    address: "",
    detailedAddress: "",
    description: "",
    capacity: 0,
    price: 0,
    submittedAt: pending?.submittedAt ?? new Date().toISOString(),
    status: isPending ? "PendingReview" : "Approved",
    approvalBadge: isPending ? "Pending" : "Approved",
    ownerId: "",
    ownerFullName: "",
    ownerPhoneNumber: "",
    ownerEmail: "",
    mainImageUrl: null,
    photoUrls: [],
    youtubeVideoUrl: null,
    features: [],
    otherFeatures: null,
    adminLocked: pending?.adminLocked ?? false,
    systemLocked: pending?.systemLocked ?? false,
    lockBadgeVisible: pending?.lockBadgeVisible,
    paymentStatus: "Unpaid",
    paymentReceiptUploadedAt: null,
    hasPaymentReceipt: false,
    ownerHasIdentityDocument: false,
    cycleStart: null,
    cycleEnd: null,
    daysRemaining: null,
  };
}

export async function fetchAdminPendingHalls(): Promise<AdminPendingHall[]> {
  if (usesDemoAdminStub()) {
    return DEMO_PENDING_HALLS.map((hall) => ({ ...hall }));
  }
  const { data } = await api.get<unknown>("/admin/halls/pending", {
    params: { page: 1, pageSize: 50 },
    timeout: 10000,
  });
  return mapAdminPendingHalls(data);
}

const REJECTED_HALLS_PAGE_SIZE = 10;

/** GET /api/v1/admin/halls/rejected — Rejected halls only, same row shape as the pending queue. */
export async function fetchAdminRejectedHalls(page = 1): Promise<AdminHallPage> {
  if (usesDemoAdminStub()) {
    return { items: [], page: 1, pageSize: REJECTED_HALLS_PAGE_SIZE, totalCount: 0, totalPages: 0 };
  }
  const { data } = await api.get<unknown>("/admin/halls/rejected", {
    params: { page, pageSize: REJECTED_HALLS_PAGE_SIZE },
    timeout: 10000,
  });
  return mapAdminHallPage(data);
}

export async function fetchAdminHallDetail(hallId: string): Promise<AdminHallDetail> {
  if (usesDemoAdminStub()) {
    return buildDemoAdminHallDetail(hallId);
  }
  const { data } = await api.get<unknown>(`/admin/halls/${encodeURIComponent(hallId)}`, {
    timeout: 10000,
  });
  const mapped = mapAdminHallDetail(data);
  if (!mapped) {
    throw new ApiError("admin.halls.detail.errors.loadFailed", 0);
  }
  return mapped;
}

/**
 * PUT /api/v1/admin/halls/{hallId}/approve.
 * PendingReview or Rejected → Approved. Payment, subscription, and lock flags are untouched.
 */
export async function approveAdminHall(hallId: string): Promise<AdminHallApprovalResult> {
  if (usesDemoAdminStub()) {
    return {
      hallId,
      hallName: buildDemoAdminHallDetail(hallId).name,
      status: "Approved",
      isApproved: true,
      approvedAt: new Date().toISOString(),
    };
  }
  const { data } = await api.put<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/approve`,
    {},
    { timeout: 10000 },
  );
  const mapped = mapAdminHallApproval(data);
  if (!mapped) {
    throw new ApiError("admin.halls.approve.errors.generic", 0);
  }
  return mapped;
}

/**
 * POST /api/v1/admin/halls/{hallId}/messages (US-ADMIN-04).
 * Reuses the Conversation/Message domain. Blocked owners queue the message
 * with deliveryPending instead of a real-time push.
 */
export async function sendAdminHallMessage(
  hallId: string,
  content: string,
): Promise<AdminOwnerMessageResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new ApiError("admin.halls.message.errors.validation", 422);
  }
  if (trimmed.length > 1000) {
    throw new ApiError("admin.halls.message.errors.validation", 422);
  }

  const { data } = await api.post<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/messages`,
    { content: trimmed },
    { timeout: 10000 },
  );
  const mapped = mapAdminOwnerMessage(data);
  if (!mapped) {
    throw new ApiError("admin.halls.message.errors.generic", 0);
  }
  return mapped;
}

/**
 * PUT /api/v1/admin/halls/{hallId}/reject (US-ADMIN-03).
 * Optional reason. Live Approved halls require confirmLiveApproved: true.
 */
export async function rejectAdminHall(
  hallId: string,
  request: AdminRejectHallRequest = {},
): Promise<AdminHallRejectResult> {
  const reasonIssue = validateAdminRejectReason(request.reason ?? "");
  if (reasonIssue) {
    throw new ApiError("admin.reject.tooLong", 422);
  }

  if (usesDemoAdminStub()) {
    return {
      hallId,
      hallName: buildDemoAdminHallDetail(hallId).name,
      status: "Rejected",
      isAlreadyRejected: false,
      notificationDelivered: true,
    };
  }

  const body = toRejectAdminHallPayload({
    reason: request.reason,
    confirmLiveApproved: request.confirmLiveApproved,
  });

  const { data } = await api.put<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/reject`,
    body,
    { timeout: 10000 },
  );
  const mapped = mapAdminHallReject(data);
  if (!mapped) {
    throw new ApiError("admin.reject.errors.generic", 0);
  }
  return mapped;
}

/**
 * PUT /api/v1/admin/halls/{hallId}/lock (US-ADMIN-05).
 * Sets AdminLocked only. Never touches SystemLocked or payment.
 */
export async function lockAdminHall(hallId: string): Promise<AdminHallLockResult> {
  if (usesDemoAdminStub()) {
    return {
      hallId,
      hallName: buildDemoAdminHallDetail(hallId).name,
      adminLocked: true,
      lockedAt: new Date().toISOString(),
      lockedByAdminUserId: "demo-admin",
    };
  }
  const { data } = await api.put<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/lock`,
    {},
    { timeout: 10000 },
  );
  const mapped = mapAdminHallLock(data);
  if (!mapped) {
    throw new ApiError("admin.lock.errors.generic", 0);
  }
  return mapped;
}

/**
 * PUT /api/v1/admin/halls/{hallId}/unlock (US-ADMIN-06 / FR-SUB-05).
 * Clears AdminLocked only. Never overrides a genuine SystemLocked unpaid lock.
 */
export async function unlockAdminHall(hallId: string): Promise<AdminHallUnlockResult> {
  if (usesDemoAdminStub()) {
    return {
      hallId,
      hallName: buildDemoAdminHallDetail(hallId).name,
      adminLocked: false,
      systemLocked: false,
      managementAccessRestored: true,
      unlockedAt: new Date().toISOString(),
    };
  }
  const { data } = await api.put<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/unlock`,
    {},
    { timeout: 10000 },
  );
  const mapped = mapAdminHallUnlock(data);
  if (!mapped) {
    throw new ApiError("admin.halls.unlock.errors.generic", 0);
  }
  return mapped;
}

/**
 * PUT /api/v1/admin/halls/{hallId}/subscription/paid (US-ADMIN-10 / FR-SUB-04).
 * Sets PaymentStatus = Paid, starts a new 30-day cycle, and clears SystemLocked only.
 * Never modifies AdminLocked.
 */
export async function markAdminHallSubscriptionPaid(
  hallId: string,
): Promise<AdminMarkPaidResult> {
  if (usesDemoAdminStub()) {
    const detail = buildDemoAdminHallDetail(hallId);
    const cycleStart = new Date().toISOString();
    const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
      hallId,
      hallName: detail.name,
      status: detail.status,
      paymentStatus: "Paid",
      systemLocked: false,
      adminLocked: detail.adminLocked,
      cycleStart,
      cycleEnd,
      daysRemaining: 30,
      amountIls: detail.price,
      alreadyPaidWithActiveCycle: false,
    };
  }
  const { data } = await api.put<unknown>(
    `/admin/halls/${encodeURIComponent(hallId)}/subscription/paid`,
    {},
    { timeout: 10000 },
  );
  const mapped = mapAdminMarkPaid(data);
  if (!mapped) {
    throw new ApiError("admin.halls.paid.errors.generic", 0);
  }
  return mapped;
}

/**
 * GET /api/v1/admin/subscriptions (US-ADMIN-11 / FR-SUB-06).
 */
export async function fetchAdminSubscriptionOverview(): Promise<AdminSubscriptionOwnerGroup[]> {
  if (usesDemoAdminStub()) return [];
  const { data } = await api.get<unknown>("/admin/subscriptions", {
    timeout: 10000,
  });
  return mapAdminSubscriptionOverview(data);
}

export async function deleteAdminHall(hallId: string): Promise<void> {
  await api.delete(`/admin/halls/${encodeURIComponent(hallId)}`, {
    timeout: 10000,
  });
}
