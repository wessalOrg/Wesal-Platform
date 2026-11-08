import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAdminCoordinatorConversation,
  mapAdminCoordinatorDecision,
  mapAdminCoordinatorRequestDetail,
  mapAdminCoordinatorRequestPage,
} from "@/lib/admin-coordinators-mapper";
import { toRejectAdminCoordinatorPayload } from "@/lib/admin-reject-coordinator";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type {
  AdminCoordinatorConversationResult,
  AdminCoordinatorDecisionResult,
  AdminCoordinatorRequestDetail,
  AdminCoordinatorRequestFilter,
  AdminCoordinatorRequestPage,
} from "@/types/admin-coordinators";

const PAGE_SIZE = 10;

function usesDemoAdminStub(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return Boolean(token?.startsWith("stub-admin"));
}

/** GET /api/v1/admin/coordinators?status=&page=&pageSize= */
export async function fetchAdminCoordinatorRequests(
  status: AdminCoordinatorRequestFilter,
  page = 1,
): Promise<AdminCoordinatorRequestPage> {
  if (usesDemoAdminStub()) {
    return { items: [], page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 };
  }
  const { data } = await api.get<unknown>("/admin/coordinators", {
    params: { status, page, pageSize: PAGE_SIZE },
    timeout: 10000,
  });
  return mapAdminCoordinatorRequestPage(data);
}

/** GET /api/v1/admin/coordinators/{userId} */
export async function fetchAdminCoordinatorRequestDetail(
  userId: string,
): Promise<AdminCoordinatorRequestDetail> {
  if (usesDemoAdminStub()) {
    throw new ApiError("admin.coordinators.detail.errors.loadFailed", 0);
  }
  const { data } = await api.get<unknown>(
    `/admin/coordinators/${encodeURIComponent(userId)}`,
    { timeout: 10000 },
  );
  const mapped = mapAdminCoordinatorRequestDetail(data);
  if (!mapped) {
    throw new ApiError("admin.coordinators.detail.errors.loadFailed", 0);
  }
  return mapped;
}

/** POST /api/v1/admin/coordinators/{userId}/approve */
export async function approveAdminCoordinatorRequest(
  userId: string,
): Promise<AdminCoordinatorDecisionResult> {
  if (usesDemoAdminStub()) {
    return {
      userId,
      status: "Approved",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/coordinators/${encodeURIComponent(userId)}/approve`,
      undefined,
      { timeout: 15000 },
    );
    const mapped = mapAdminCoordinatorDecision(data);
    if (!mapped) {
      throw new ApiError("admin.coordinators.approve.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.coordinators.approve.errors.generic", 0);
  }
}

/** POST /api/v1/admin/coordinators/{userId}/reject  body: { reason } */
export async function rejectAdminCoordinatorRequest(
  userId: string,
  reason: string,
): Promise<AdminCoordinatorDecisionResult> {
  if (usesDemoAdminStub()) {
    return {
      userId,
      status: "Rejected",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/coordinators/${encodeURIComponent(userId)}/reject`,
      toRejectAdminCoordinatorPayload(reason),
      { timeout: 15000 },
    );
    const mapped = mapAdminCoordinatorDecision(data);
    if (!mapped) {
      throw new ApiError("admin.coordinators.reject.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.coordinators.reject.errors.generic", 0);
  }
}

/**
 * GET /api/v1/admin/coordinators/{userId}/conversation
 * Resolves or creates the Admin↔coordinator thread; never posts a message.
 */
export async function openAdminCoordinatorConversation(
  userId: string,
): Promise<AdminCoordinatorConversationResult> {
  if (usesDemoAdminStub()) {
    return {
      conversationId: `demo-coord-${userId}`,
      userId,
      isExisting: true,
    };
  }
  try {
    const { data } = await api.get<unknown>(
      `/admin/coordinators/${encodeURIComponent(userId)}/conversation`,
      { timeout: 10000 },
    );
    const mapped = mapAdminCoordinatorConversation(data);
    if (!mapped) {
      throw new ApiError("admin.coordinators.contact.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.coordinators.contact.errors.generic", 0);
  }
}
