import type { HallRegion } from "@/constants/hallRegions";

export type BookingPeriodFormValues = {
  startTime: string;
  endTime: string;
};

export type HallRegistrationFormValues = {
  hallName: string;
  ownerPhone: string;
  region: HallRegion | "";
  detailedAddress: string;
  description: string;
  guestCapacity: string;
  /** Keep empty string when unused — never coerce to "0". */
  rentalPrice: string;
  firstPeriod: BookingPeriodFormValues;
  secondPeriod: BookingPeriodFormValues;
  photos: File[];
};

export type HallRegistrationFieldPath =
  | "hallName"
  | "ownerPhone"
  | "region"
  | "detailedAddress"
  | "description"
  | "guestCapacity"
  | "rentalPrice"
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
  detailedAddress: "",
  description: "",
  guestCapacity: "",
  rentalPrice: "",
  firstPeriod: { ...EMPTY_BOOKING_PERIOD },
  secondPeriod: { ...EMPTY_BOOKING_PERIOD },
  photos: [],
};
