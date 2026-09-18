import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { HallRegion } from "@/constants/hallRegions";
import type {
  BookingPeriodFormValues,
  HallRegistrationFieldErrors,
  HallRegistrationFieldPath,
} from "@/types/hall-registration";

/** Backend-driven edit gate — never infer from Approved alone as the full rule. */
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
  description: string;
  capacity: number;
  price: number | null;
  showPrice: boolean;
  mainImageUrl: string | null;
  photos: ExistingHallPhoto[];
  firstPeriod: BookingPeriodFormValues;
  secondPeriod: BookingPeriodFormValues;
};

export type HallEditFormValues = {
  hallName: string;
  ownerPhone: string;
  region: HallRegion | "";
  detailedAddress: string;
  description: string;
  guestCapacity: string;
  /** Empty string when unused — never coerce to "0". */
  rentalPrice: string;
  firstPeriod: BookingPeriodFormValues;
  secondPeriod: BookingPeriodFormValues;
  existingPhotos: ExistingHallPhoto[];
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
  | "error";
