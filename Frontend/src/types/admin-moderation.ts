import type { PagedResult } from "@/types/posts";

export type AdminModerationContentKind = "post" | "offer";

export type AdminModerationOwnerRole =
  | "EventCoordinator"
  | "Photographer"
  | string;

export type AdminModeratedImage = {
  id: string;
  url: string;
  order: number;
};

/** Mapped `AdminModeratedContentDto` for posts and professional offers. */
export type AdminModeratedContent = {
  id: string;
  kind: AdminModerationContentKind;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerRole: AdminModerationOwnerRole;
  ownerIsLocked: boolean;
  content: string | null;
  price: number | null;
  oldPrice: number | null;
  offerPrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
  stoppedAt: string | null;
  status: string | null;
  createdAt: string | null;
  images: AdminModeratedImage[];
};

export type AccountLockStatus = {
  isLocked: boolean;
  lockedUntil: string | null;
  reason: string | null;
};

export type AdminLockedAccount = {
  userId: string;
  displayName: string;
  businessName: string | null;
  role: string;
  lockedAt: string;
  lockedUntil: string;
  remainingMs: number;
  reason: string | null;
  lockingAdminId: string;
  photographerAdminOnlyFullName: string | null;
  unlockAction: string;
};

export type AdminActionResult = {
  success: boolean;
  removedCount: number;
  removedItems: Record<string, number>;
};

export type DeleteContentPayload = {
  reason: string;
};

export type CreateAccountLockPayload = {
  durationHours: number;
  reason?: string | null;
};

export type AdminModerationListQuery = {
  ownerId?: string;
  ownerRole?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

export type AdminModeratedContentPage = PagedResult<AdminModeratedContent>;
export type AdminLockedAccountPage = PagedResult<AdminLockedAccount>;

/** Client-side reason length (Figma). Backend allows up to 1000. */
export const MODERATION_REASON_MAX = 300;

export const LOCK_DURATION_PRESETS = [
  { id: "24h", hours: 24 },
  { id: "3d", hours: 72 },
  { id: "7d", hours: 168 },
  { id: "30d", hours: 720 },
] as const;

export type LockDurationPresetId = (typeof LOCK_DURATION_PRESETS)[number]["id"] | "custom";
