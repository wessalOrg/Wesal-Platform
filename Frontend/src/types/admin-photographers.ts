import type { AccountApprovalStatus } from "@/types/account-approval";

/** Queue filters for Admin Photographer Requests (Task 7). */
export type AdminPhotographerRequestFilter =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "NeedsChanges";

export type AdminPhotographerRequestSummary = {
  userId: string;
  fullName: string;
  email: string;
  approvalStatus: AccountApprovalStatus;
  hasStudio: boolean;
  /** Studio name when hasStudio; otherwise empty — UI falls back to fullName/email. */
  displayName: string;
  submittedAt: string | null;
};

export type AdminPhotographerRequestDetail = {
  userId: string;
  fullName: string;
  email: string;
  userPhoneNumber: string | null;
  approvalStatus: AccountApprovalStatus;
  isSetupComplete: boolean;
  hasStudio: boolean;
  studioName: string | null;
  studioLocation: string | null;
  detailedStudioLocation: string | null;
  /** Admin-only legal name for independent photographers. Null on studio branch. */
  legalFullName: string | null;
  setupPhoneNumber: string;
  submittedAt: string | null;
  hasIdentityDocument: boolean;
};

export type AdminPhotographerRequestPage = {
  items: AdminPhotographerRequestSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminPhotographerDecisionResult = {
  userId: string;
  status: AccountApprovalStatus;
  notificationDelivered: boolean;
};

export type AdminPhotographerConversationResult = {
  conversationId: string;
  userId: string;
  isExisting: boolean;
};
