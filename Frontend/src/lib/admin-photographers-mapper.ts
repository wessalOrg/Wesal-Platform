import { normalizeAccountApprovalStatus } from "@/lib/account-approval";
import type { AccountApprovalStatus } from "@/types/account-approval";
import type {
  AdminPhotographerConversationResult,
  AdminPhotographerDecisionResult,
  AdminPhotographerRequestDetail,
  AdminPhotographerRequestFilter,
  AdminPhotographerRequestPage,
  AdminPhotographerRequestSummary,
} from "@/types/admin-photographers";

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

function mapApproval(raw: unknown): AccountApprovalStatus | null {
  return normalizeAccountApprovalStatus(
    typeof raw === "number" || typeof raw === "string" ? raw : asText(raw),
  );
}

export function isAdminPhotographerFilter(
  value: string | null | undefined,
): value is AdminPhotographerRequestFilter {
  return (
    value === "Pending" ||
    value === "Approved" ||
    value === "Rejected" ||
    value === "NeedsChanges"
  );
}

export function mapAdminPhotographerRequestSummary(
  payload: unknown,
): AdminPhotographerRequestSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  const approvalStatus = mapApproval(dto.approvalStatus ?? dto.ApprovalStatus);
  if (!userId || !approvalStatus) return null;

  const hasStudio = asBool(dto.hasStudio ?? dto.HasStudio);
  const displayName =
    asText(dto.displayName ?? dto.DisplayName) ||
    asText(dto.fullName ?? dto.FullName);

  return {
    userId,
    fullName: asText(dto.fullName ?? dto.FullName),
    email: asText(dto.email ?? dto.Email),
    approvalStatus,
    hasStudio,
    displayName,
    submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
  };
}

export function mapAdminPhotographerRequestPage(
  payload: unknown,
): AdminPhotographerRequestPage {
  if (!payload || typeof payload !== "object") {
    return { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
  }
  const dto = payload as Record<string, unknown>;
  const rawItems = dto.items ?? dto.Items;
  const items = Array.isArray(rawItems)
    ? rawItems
        .map(mapAdminPhotographerRequestSummary)
        .filter((row): row is AdminPhotographerRequestSummary => Boolean(row))
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

export function mapAdminPhotographerRequestDetail(
  payload: unknown,
): AdminPhotographerRequestDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  const approvalStatus = mapApproval(dto.approvalStatus ?? dto.ApprovalStatus);
  if (!userId || !approvalStatus) return null;

  const identityPath = asText(dto.identityDocumentUrl ?? dto.IdentityDocumentUrl);
  const hasStudio = asBool(dto.hasStudio ?? dto.HasStudio);

  return {
    userId,
    fullName: asText(dto.fullName ?? dto.FullName),
    email: asText(dto.email ?? dto.Email),
    userPhoneNumber: asText(dto.userPhoneNumber ?? dto.UserPhoneNumber) || null,
    approvalStatus,
    isSetupComplete: asBool(dto.isSetupComplete ?? dto.IsSetupComplete),
    hasStudio,
    studioName: asText(dto.studioName ?? dto.StudioName) || null,
    studioLocation: asText(dto.studioLocation ?? dto.StudioLocation) || null,
    detailedStudioLocation:
      asText(dto.detailedStudioLocation ?? dto.DetailedStudioLocation) || null,
    legalFullName: asText(dto.legalFullName ?? dto.LegalFullName) || null,
    setupPhoneNumber: asText(dto.setupPhoneNumber ?? dto.SetupPhoneNumber),
    submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
    hasIdentityDocument: Boolean(identityPath),
  };
}

export function mapAdminPhotographerDecision(
  payload: unknown,
): AdminPhotographerDecisionResult | null {
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

export function mapAdminPhotographerConversation(
  payload: unknown,
): AdminPhotographerConversationResult | null {
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

/** Pending-only — matches Task 6 Admin UX and Task 7 expected flow. */
export function canApprovePhotographer(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}

export function canRejectPhotographer(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}

export function canRequestChangesPhotographer(
  status: AccountApprovalStatus | null | undefined,
): boolean {
  return status === "Pending";
}
