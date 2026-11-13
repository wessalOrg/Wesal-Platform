import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAdminCoordinatorConversation,
  mapAdminCoordinatorDecision,
  mapAdminCoordinatorRequestDetail,
  mapAdminCoordinatorRequestPage,
} from "@/lib/admin-coordinators-mapper";
import { toRejectAdminCoordinatorPayload } from "@/lib/admin-reject-coordinator";
import { toRequestChangesAdminCoordinatorPayload } from "@/lib/admin-request-changes-coordinator";
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

/** Local demo-only coordinator request for layout review (stub-admin). */
export const DEMO_COORDINATOR_REQUEST_ID = "demo-coord-sara";

type DemoApprovalStatus = AdminCoordinatorRequestDetail["approvalStatus"];

let demoCoordinatorStatus: DemoApprovalStatus = "Pending";

function usesDemoAdminStub(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return Boolean(token?.startsWith("stub-admin"));
}

function buildDemoCoordinatorDetail(
  status: DemoApprovalStatus = demoCoordinatorStatus,
): AdminCoordinatorRequestDetail {
  return {
    userId: DEMO_COORDINATOR_REQUEST_ID,
    fullName: "سارة خليل",
    email: "sara@gmail.com",
    userPhoneNumber: "+972 59 123 4567",
    approvalStatus: status,
    isSetupComplete: true,
    businessType: "Freelance",
    shopName: null,
    shopLocation: "غزة - الرمال",
    onlineStoreName: "تنسيق فعاليات ومؤتمرات",
    setupPhoneNumber: "+972 59 123 4567",
    submittedAt: "2025-06-20T10:00:00.000Z",
    hasIdentityDocument: true,
    hasShopPhoto: false,
    hasWorkPhoto1: true,
    hasWorkPhoto2: true,
  };
}

function buildDemoCoordinatorPage(
  status: AdminCoordinatorRequestFilter,
  page: number,
): AdminCoordinatorRequestPage {
  const detail = buildDemoCoordinatorDetail();
  const matches =
    status === "Pending"
      ? detail.approvalStatus === "Pending" || detail.approvalStatus === "NeedsChanges"
      : detail.approvalStatus === status;
  const items = matches
    ? [
        {
          userId: detail.userId,
          fullName: "سارة أحمد",
          email: detail.email,
          approvalStatus: detail.approvalStatus,
          businessType: detail.businessType,
          displayName: detail.onlineStoreName || detail.fullName,
          submittedAt: detail.submittedAt,
        },
      ]
    : [];
  return {
    items,
    page: Math.max(1, page),
    pageSize: PAGE_SIZE,
    totalCount: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  };
}

/** GET /api/v1/admin/coordinators?status=&page=&pageSize= */
export async function fetchAdminCoordinatorRequests(
  status: AdminCoordinatorRequestFilter,
  page = 1,
): Promise<AdminCoordinatorRequestPage> {
  if (usesDemoAdminStub()) {
    return buildDemoCoordinatorPage(status, page);
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
    if (userId !== DEMO_COORDINATOR_REQUEST_ID) {
      throw new ApiError("admin.coordinators.detail.errors.notFound", 404);
    }
    return buildDemoCoordinatorDetail();
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
    demoCoordinatorStatus = "Approved";
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
    demoCoordinatorStatus = "Rejected";
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

/** POST /api/v1/admin/coordinators/{userId}/request-changes  body: { notes } */
export async function requestChangesAdminCoordinatorRequest(
  userId: string,
  notes: string,
): Promise<AdminCoordinatorDecisionResult> {
  if (usesDemoAdminStub()) {
    demoCoordinatorStatus = "NeedsChanges";
    return {
      userId,
      status: "NeedsChanges",
      notificationDelivered: false,
    };
  }
  try {
    const { data } = await api.post<unknown>(
      `/admin/coordinators/${encodeURIComponent(userId)}/request-changes`,
      toRequestChangesAdminCoordinatorPayload(notes),
      { timeout: 15000 },
    );
    const mapped = mapAdminCoordinatorDecision(data);
    if (!mapped) {
      throw new ApiError("admin.coordinators.requestChanges.errors.generic", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("admin.coordinators.requestChanges.errors.generic", 0);
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
