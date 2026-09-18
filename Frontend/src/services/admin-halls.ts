import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAdminHallApproval,
  mapAdminHallDetail,
  mapAdminHallUnlock,
  mapAdminMarkPaid,
  mapAdminOwnerMessage,
  mapAdminPendingHalls,
  mapAdminSubscriptionOverview,
} from "@/lib/admin-halls-mapper";
import type {
  AdminHallApprovalResult,
  AdminHallDetail,
  AdminHallUnlockResult,
  AdminMarkPaidResult,
  AdminOwnerMessageResult,
  AdminPendingHall,
  AdminSubscriptionOwnerGroup,
} from "@/types/admin-halls";

export async function fetchAdminPendingHalls(): Promise<AdminPendingHall[]> {
  const { data } = await api.get<unknown>("/admin/halls/pending", {
    params: { page: 1, pageSize: 50 },
    timeout: 10000,
  });
  return mapAdminPendingHalls(data);
}

export async function fetchAdminHallDetail(hallId: string): Promise<AdminHallDetail> {
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
 * PUT /api/v1/admin/halls/{hallId}/approve (US-ADMIN-02 / FR-ADM-03).
 * Only HallStatus PendingReview → Approved. Payment/subscription are untouched.
 */
export async function approveAdminHall(hallId: string): Promise<AdminHallApprovalResult> {
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
 * PUT /api/v1/admin/halls/{hallId}/unlock (US-ADMIN-06 / FR-SUB-05).
 * Clears AdminLocked only. Never overrides a genuine SystemLocked unpaid lock.
 */
export async function unlockAdminHall(hallId: string): Promise<AdminHallUnlockResult> {
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
  const { data } = await api.get<unknown>("/admin/subscriptions", {
    timeout: 10000,
  });
  return mapAdminSubscriptionOverview(data);
}
