import { normalizeAccountApprovalStatus } from "@/lib/account-approval";
import type { AccountApprovalStatus } from "@/types/account-approval";
import type {
  AdminCoordinatorConversationResult,
  AdminCoordinatorDecisionResult,
  AdminCoordinatorRequestDetail,
  AdminCoordinatorRequestFilter,
  AdminCoordinatorRequestPage,
  AdminCoordinatorRequestSummary,
  CoordinatorBusinessType,
} from "@/types/admin-coordinators";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asId(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1";
  }
  return false;
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return 0;
}

function mapBusinessType(raw: unknown): CoordinatorBusinessType | null {
  const text = asText(raw);
  if (!text) return null;
  const token = text.replace(/[\s_-]/g, "").toLowerCase();
  if (token === "shop" || token === "1") return "Shop";
  if (token === "freelance" || token === "independent" || token === "2") return "Freelance";
  if (typeof raw === "number") {
    if (raw === 1) return "Shop";
    if (raw === 2) return "Freelance";
  }
  return null;
}

function mapApproval(raw: unknown): AccountApprovalStatus | null {
  return normalizeAccountApprovalStatus(
    typeof raw === "number" || typeof raw === "string" ? raw : asText(raw),
  );
}

export function isAdminCoordinatorFilter(
  value: string | null | undefined,
): value is AdminCoordinatorRequestFilter {
  return value === "Pending" || value === "Approved" || value === "Rejected";
}

export function mapAdminCoordinatorRequestSummary(
  payload: unknown,
): AdminCoordinatorRequestSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  const businessType = mapBusinessType(dto.businessType ?? dto.BusinessType);
  const approvalStatus = mapApproval(dto.approvalStatus ?? dto.ApprovalStatus);
  if (!userId || !businessType || !approvalStatus) return null;

  const displayName =
    asText(dto.displayName ?? dto.DisplayName) ||
    asText(dto.fullName ?? dto.FullName);

  return {
    userId,
    fullName: asText(dto.fullName ?? dto.FullName),
    email: asText(dto.email ?? dto.Email),
    approvalStatus,
    businessType,
    displayName,
    submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
  };
}

export function mapAdminCoordinatorRequestPage(
  payload: unknown,
): AdminCoordinatorRequestPage {
  if (!payload || typeof payload !== "object") {
    return { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
  }
  const dto = payload as Record<string, unknown>;
  const rawItems = dto.items ?? dto.Items;
  const items = Array.isArray(rawItems)
    ? rawItems
        .map(mapAdminCoordinatorRequestSummary)
        .filter((row): row is AdminCoordinatorRequestSummary => Boolean(row))
    : [];

  const page = Math.max(1, asInt(dto.pageNumber ?? dto.PageNumber ?? dto.page ?? 1));
  const pageSize = Math.max(1, asInt(dto.pageSize ?? dto.PageSize ?? 10));
  const totalCount = Math.max(0, asInt(dto.totalCount ?? dto.TotalCount ?? items.length));
  const totalPages = Math.max(
    0,
    asInt(dto.totalPages ?? dto.TotalPages) ||
      (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0),
  );

  return { items, page, pageSize, totalCount, totalPages };
}

export function mapAdminCoordinatorRequestDetail(
  payload: unknown,
): AdminCoordinatorRequestDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  const businessType = mapBusinessType(dto.businessType ?? dto.BusinessType);
  const approvalStatus = mapApproval(dto.approvalStatus ?? dto.ApprovalStatus);
  if (!userId || !businessType || !approvalStatus) return null;

  const identityPath = asText(dto.identityDocumentUrl ?? dto.IdentityDocumentUrl);
  const shopPath = asText(dto.shopPhotoUrl ?? dto.ShopPhotoUrl);
  const work1Path = asText(dto.workPhoto1Url ?? dto.WorkPhoto1Url);
  const work2Path = asText(dto.workPhoto2Url ?? dto.WorkPhoto2Url);

  return {
    userId,
    fullName: asText(dto.fullName ?? dto.FullName),
    email: asText(dto.email ?? dto.Email),
    userPhoneNumber: asText(dto.userPhoneNumber ?? dto.UserPhoneNumber) || null,
    approvalStatus,
    isSetupComplete: asBool(dto.isSetupComplete ?? dto.IsSetupComplete),
    businessType,
    shopName: asText(dto.shopName ?? dto.ShopName) || null,
    shopLocation: asText(dto.shopLocation ?? dto.ShopLocation) || null,
    onlineStoreName: asText(dto.onlineStoreName ?? dto.OnlineStoreName) || null,
    setupPhoneNumber: asText(dto.setupPhoneNumber ?? dto.SetupPhoneNumber),
    submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
    hasIdentityDocument: Boolean(identityPath),
    hasShopPhoto: Boolean(shopPath),
    hasWorkPhoto1: Boolean(work1Path),
    hasWorkPhoto2: Boolean(work2Path),
  };
}

export function mapAdminCoordinatorDecision(
  payload: unknown,
): AdminCoordinatorDecisionResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  const status = mapApproval(dto.status ?? dto.Status);
  if (!userId || !status) return null;
  return {
    userId,
    status,
    notificationDelivered: asBool(
      dto.notificationDelivered ?? dto.NotificationDelivered,
    ),
  };
}

export function mapAdminCoordinatorConversation(
  payload: unknown,
): AdminCoordinatorConversationResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const conversationId = asId(dto.conversationId ?? dto.ConversationId);
  const userId = asId(dto.userId ?? dto.UserId);
  if (!conversationId || !userId) return null;
  return {
    conversationId,
    userId,
    isExisting: asBool(dto.isExisting ?? dto.IsExisting),
  };
}

export function canApproveCoordinator(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}

export function canRejectCoordinator(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}

export function canRequestChangesCoordinator(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}
