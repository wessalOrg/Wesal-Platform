import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAdminPhotographerConversation,
  mapAdminPhotographerDecision,
  mapAdminPhotographerRequestDetail,
  mapAdminPhotographerRequestPage,
} from "@/lib/admin-photographers-mapper";
import { toRejectAdminPhotographerPayload } from "@/lib/admin-reject-photographer";
import { toRequestChangesAdminPhotographerPayload } from "@/lib/admin-request-changes-photographer";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type {
  AdminPhotographerConversationResult,
  AdminPhotographerDecisionResult,
  AdminPhotographerRequestDetail,
  AdminPhotographerRequestFilter,
  AdminPhotographerRequestPage,
} from "@/types/admin-photographers";

const PAGE_SIZE = 10;

function usesDemoAdminStub(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return Boolean(token?.startsWith("stub-admin"));
}

/** GET /api/v1/admin/photographers?status=&page=&pageSize= */
export async function fetchAdminPhotographerRequests(
  status: AdminPhotographerRequestFilter,
  page = 1,
): Promise<AdminPhotographerRequestPage> {
  if (usesDemoAdminStub()) {
    return { items: [], page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 };
  }
  const { data } = await api.get<unknown>("/admin/photographers", {
    params: { status, page, pageSize: PAGE_SIZE },
    timeout: 10000,
  });
  return mapAdminPhotographerRequestPage(data);
}

/** GET /api/v1/admin/photographers/{userId} */
export async function fetchAdminPhotographerRequestDetail(
  userId: string,
): Promise<AdminPhotographerRequestDetail> {
  if (usesDemoAdminStub()) {
    throw new ApiError("admin.photographers.detail.errors.loadFailed", 0);
  }
  const { data } = await api.get<unknown>(
    `/admin/photographers/${encodeURIComponent(userId)}`,
    { timeout: 10000 },
  );
  const mapped = mapAdminPhotographerRequestDetail(data);
  if (!mapped) {
    throw new ApiError("admin.photographers.detail.errors.loadFailed", 0);
  }
  return mapped;
}

/** POST /api/v1/admin/photographers/{userId}/approve */
export async function approveAdminPhotographerRequest(
  userId: string,
): Promise<AdminPhotographerDecisionResult> {
  if (usesDemoAdminStub()) {
    return {
      userId,
      status: "Approved",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/photographers/${encodeURIComponent(userId)}/approve`,
      undefined,
      { timeout: 15000 },
    );
    const mapped = mapAdminPhotographerDecision(data);
    if (!mapped) {
      throw new ApiError("admin.photographers.approve.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.photographers.approve.errors.generic", 0);
  }
}

/** POST /api/v1/admin/photographers/{userId}/reject  body: { reason } */
export async function rejectAdminPhotographerRequest(
  userId: string,
  reason: string,
): Promise<AdminPhotographerDecisionResult> {
  if (usesDemoAdminStub()) {
    return {
      userId,
      status: "Rejected",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/photographers/${encodeURIComponent(userId)}/reject`,
      toRejectAdminPhotographerPayload(reason),
      { timeout: 15000 },
    );
    const mapped = mapAdminPhotographerDecision(data);
    if (!mapped) {
      throw new ApiError("admin.photographers.reject.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.photographers.reject.errors.generic", 0);
  }
}

/** POST /api/v1/admin/photographers/{userId}/request-changes  body: { notes } */
export async function requestChangesAdminPhotographerRequest(
  userId: string,
  notes: string,
): Promise<AdminPhotographerDecisionResult> {
  if (usesDemoAdminStub()) {
    return {
      userId,
      status: "NeedsChanges",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/photographers/${encodeURIComponent(userId)}/request-changes`,
      toRequestChangesAdminPhotographerPayload(notes),
      { timeout: 15000 },
    );
    const mapped = mapAdminPhotographerDecision(data);
    if (!mapped) {
      throw new ApiError("admin.photographers.requestChanges.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.photographers.requestChanges.errors.generic", 0);
  }
}

/**
 * GET /api/v1/admin/photographers/{userId}/conversation
 * Resolves or creates the Admin↔photographer thread; never posts a message.
 */
export async function openAdminPhotographerConversation(
  userId: string,
): Promise<AdminPhotographerConversationResult> {
  if (usesDemoAdminStub()) {
    return {
      conversationId: `demo-photo-${userId}`,
      userId,
      isExisting: true,
    };
  }
  try {
    const { data } = await api.get<unknown>(
      `/admin/photographers/${encodeURIComponent(userId)}/conversation`,
      { timeout: 10000 },
    );
    const mapped = mapAdminPhotographerConversation(data);
    if (!mapped) {
      throw new ApiError("admin.photographers.contact.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.photographers.contact.errors.generic", 0);
  }
}
