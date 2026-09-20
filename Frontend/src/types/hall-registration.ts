import type { HallRegion } from "@/constants/hallRegions";

export type BookingPeriodFormValues = {
  startTime: string;
  endTime: string;
};

export type HallRegistrationFormValues = {
  hallName: string;
  ownerPhone: string;
  region: HallRegion | "";
  /**
   * Short address picked from the selected region's address catalog (required,
   * `CreateHallRequest.Address`, max 100).
   */
  address: string;
  /** Extended free-text address (`CreateHallRequest.DetailedAddress`, optional, max 150). */
  detailedAddress: string;
  description: string;
  guestCapacity: string;
  /** Keep empty string when unused — never coerce to "0". */
  rentalPrice: string;
  /** Optional YouTube video URL (`CreateHallRequest.YouTubeVideoUrl`). */
  youtubeVideoUrl: string;
  /** Feature names selected from the predefined catalog (canonical Arabic strings). */
  features: string[];
  /** Additional owner-typed features (`CreateHallRequest.OtherFeatures`, max 200). */
  otherFeatures: string;
  /** Optional cover photo (`CreateHallRequest.MainPhoto`) promoted to MainImageUrl. */
  mainPhoto: File | null;
  firstPeriod: BookingPeriodFormValues;
  secondPeriod: BookingPeriodFormValues;
  photos: File[];
};

export type HallRegistrationFieldPath =
  | "hallName"
  | "ownerPhone"
  | "region"
  | "address"
  | "detailedAddress"
  | "description"
  | "guestCapacity"
  | "rentalPrice"
  | "youtubeVideoUrl"
  | "features"
  | "otherFeatures"
  | "mainPhoto"
  | "firstPeriod.startTime"
  | "firstPeriod.endTime"
  | "secondPeriod.startTime"
  | "secondPeriod.endTime"
  | "photos"
  | "firstPeriod"
  | "secondPeriod";

export type HallRegistrationFieldErrors = Partial<
  Record<HallRegistrationFieldPath, string>
>;

export type HallRegistrationSubmitStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error";

export type CreateHallResult = {
  hallId: string | null;
};

export const EMPTY_BOOKING_PERIOD: BookingPeriodFormValues = {
  startTime: "",
  endTime: "",
};

export const EMPTY_HALL_REGISTRATION_VALUES: HallRegistrationFormValues = {
  hallName: "",
  ownerPhone: "",
  region: "",
  address: "",
  detailedAddress: "",
  description: "",
  guestCapacity: "",
  rentalPrice: "",
  youtubeVideoUrl: "",
  features: [],
  otherFeatures: "",
  mainPhoto: null,
  firstPeriod: { ...EMPTY_BOOKING_PERIOD },
  secondPeriod: { ...EMPTY_BOOKING_PERIOD },
  photos: [],
};
