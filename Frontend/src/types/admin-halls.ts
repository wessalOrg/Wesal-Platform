import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";

/** Backend HallStatus (JsonStringEnumConverter). */
export type AdminHallStatus = "PendingReview" | "Approved" | "Rejected";

export type AdminHallDetail = {
  hallId: string;
  name: string;
  regionDisplayName: string;
  address: string;
  detailedAddress: string | null;
  description: string | null;
  capacity: number;
  price: number | null;
  submittedAt: string | null;
  status: AdminHallStatus;
  approvalBadge: HallApprovalStatus;
  ownerId: string | null;
  ownerFullName: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  /** Cover image (MainImageUrl), absolute for the browser. */
  mainImageUrl: string | null;
  /** Cover first, then gallery — all resolved via resolveMediaUrl. */
  photoUrls: string[];
  youtubeVideoUrl: string | null;
  features: string[];
  otherFeatures: string | null;
  adminLocked: boolean;
  systemLocked: boolean;
  lockBadgeVisible?: boolean;
  paymentStatus: AdminPaymentStatus;
  paymentReceiptUploadedAt: string | null;
  hasPaymentReceipt: boolean;
  ownerHasIdentityDocument: boolean;
  cycleStart: string | null;
  cycleEnd: string | null;
  daysRemaining: number | null;
};

export type AdminPendingHall = {
  hallId: string;
  name: string;
  thumbnailUrl: string | null;
  submittedAt: string | null;
  adminLocked: boolean;
  systemLocked: boolean;
  lockBadgeVisible?: boolean;
};

export type AdminHallApprovalResult = {
  hallId: string;
  hallName: string;
  status: AdminHallStatus;
  isApproved: boolean;
  approvedAt: string | null;
};

/** POST /admin/halls/{hallId}/messages (US-ADMIN-04 / FR-ADM-02/03/04). */
export type AdminOwnerMessageResult = {
  messageId: string;
  conversationId: string;
  hallId: string;
  content: string;
  sentAt: string;
  ownerBlocked: boolean;
  deliveryPending: boolean;
};

export type AdminOwnerMessageTarget = {
  hallId: string;
  hallName: string;
  ownerName?: string | null;
};

/** PUT /admin/halls/{hallId}/reject (US-ADMIN-03). */
export type AdminRejectHallRequest = {
  reason?: string;
  confirmLiveApproved?: boolean;
};

export type AdminHallRejectResult = {
  hallId: string;
  hallName: string;
  status: AdminHallStatus;
  isAlreadyRejected: boolean;
  notificationDelivered: boolean;
};

/** PUT /admin/halls/{hallId}/lock (US-ADMIN-05). */
export type AdminHallLockResult = {
  hallId: string;
  hallName: string;
  adminLocked: boolean;
  lockedAt: string | null;
  lockedByAdminUserId: string | null;
};

/** PUT /admin/halls/{hallId}/unlock (US-ADMIN-06 / FR-SUB-05). */
export type AdminHallUnlockResult = {
  hallId: string;
  hallName: string;
  adminLocked: boolean;
  systemLocked: boolean;
  managementAccessRestored: boolean;
  unlockedAt: string | null;
};

export type AdminHallLockAccess = "adminLocked" | "unpaidLocked" | "unlocked";

/** Backend HallPaymentStatus (JsonStringEnumConverter). */
export type AdminPaymentStatus = "Paid" | "ReceiptUploaded" | "Unpaid";

/** PUT /admin/halls/{hallId}/subscription/paid (US-ADMIN-10 / FR-SUB-04). */
export type AdminMarkPaidResult = {
  hallId: string;
  hallName: string;
  status: AdminHallStatus;
  paymentStatus: AdminPaymentStatus;
  systemLocked: boolean;
  adminLocked: boolean;
  cycleStart: string | null;
  cycleEnd: string | null;
  daysRemaining: number | null;
  amountIls: number | null;
  alreadyPaidWithActiveCycle: boolean;
};

export type AdminSubscriptionHall = {
  hallId: string;
  name: string;
  approvalStatus: AdminHallStatus;
  paymentStatus: AdminPaymentStatus;
  systemLocked: boolean;
  adminLocked: boolean;
  nextBillingDate: string | null;
  daysRemaining: number | null;
  lastPaymentDate: string | null;
};

export type AdminSubscriptionOwnerGroup = {
  ownerId: string;
  ownerFullName: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  halls: AdminSubscriptionHall[];
};
