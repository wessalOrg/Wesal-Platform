import type { AccountApprovalStatus } from "@/types/account-approval";

/** Backend CoordinatorBusinessType (JsonStringEnumConverter). */
export type CoordinatorBusinessType = "Shop" | "Freelance";

/** Queue filters for Admin Coordinator Requests (Task 6). */
export type AdminCoordinatorRequestFilter =
  | "Pending"
  | "Approved"
  | "Rejected";

export type AdminCoordinatorRequestSummary = {
  userId: string;
  fullName: string;
  email: string;
  approvalStatus: AccountApprovalStatus;
  businessType: CoordinatorBusinessType;
  displayName: string;
  submittedAt: string | null;
};

export type AdminCoordinatorRequestDetail = {
  userId: string;
  fullName: string;
  email: string;
  userPhoneNumber: string | null;
  approvalStatus: AccountApprovalStatus;
  isSetupComplete: boolean;
  businessType: CoordinatorBusinessType;
  shopName: string | null;
  shopLocation: string | null;
  onlineStoreName: string | null;
  setupPhoneNumber: string;
  submittedAt: string | null;
  /** True when the identity document endpoint is available for this request. */
  hasIdentityDocument: boolean;
  /** Shop branch only. */
  hasShopPhoto: boolean;
  /** Freelance branch — work photo 1. */
  hasWorkPhoto1: boolean;
  /** Freelance branch — work photo 2. */
  hasWorkPhoto2: boolean;
};

export type AdminCoordinatorRequestPage = {
  items: AdminCoordinatorRequestSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminCoordinatorDecisionResult = {
  userId: string;
  status: AccountApprovalStatus;
  notificationDelivered: boolean;
};

export type AdminCoordinatorConversationResult = {
  conversationId: string;
  userId: string;
  isExisting: boolean;
};
