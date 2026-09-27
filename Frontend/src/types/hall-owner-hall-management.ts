import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import type { HallRegion } from "@/constants/hallRegions";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFieldPath,
} from "@/types/hall-registration";

/**
 * Backend-driven edit gate. Approval status is never a lock.
 * `underReview` is kept for older cached payloads and is treated as editable.
 */
export type HallEditability = "editable" | "locked" | "underReview";

export type ExistingHallPhoto = {
  id: string;
  /** Absolute URL for display (may be resolved from API origin). */
  url: string;
  /** Path/URL to send back on PUT (prefer relative `/uploads/...`). */
  apiUrl?: string;
};

export type HallOwnerHallDetails = {
  id: string;
  name: string;
  status: HallApprovalStatus;
  editability: HallEditability;
  contactPhone: string;
  region: HallRegion | "";
  address: string;
  detailedAddress: string;
  description: string;
  capacity: number;
  price: number | null;
  showPrice: boolean;
  youtubeVideoUrl: string;
  features: string[];
  otherFeatures: string;
  paymentStatus: HallPaymentStatus;
  paymentReceiptUploadedAt: string | null;
  hasPaymentReceipt: boolean;
  mainImageUrl: string | null;
  photos: ExistingHallPhoto[];
  adminLocked: boolean;
  systemLocked: boolean;
};

export type HallEditFormValues = {
  hallName: string;
  ownerPhone: string;
  region: HallRegion | "";
  address: string;
  detailedAddress: string;
  description: string;
  guestCapacity: string;
  /** Empty string when unused — never coerce to "0". */
  rentalPrice: string;
  youtubeVideoUrl: string;
  features: string[];
  otherFeatures: string;
  existingPhotos: ExistingHallPhoto[];
  /** URL of the existing photo used as the cover (mainImageUrl on PUT). */
  coverPhotoUrl: string | null;
  /** Replacement cover file — tracked separately from existing media IDs. */
  mainPhoto: File | null;
  /** Newly picked gallery files — never mixed with existing photo IDs. */
  photos: File[];
};

export type HallEditFieldErrors = HallRegistrationFieldErrors;
export type HallEditFieldPath = HallRegistrationFieldPath;

export type HallEditSubmitStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error";

export type HallDetailsLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "payment_required"
  | "system_locked"
  | "admin_locked";
