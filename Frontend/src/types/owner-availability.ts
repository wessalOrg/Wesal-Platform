import type { BookingPeriodType } from "@/types/booking";

export type OwnerPeriodAvailabilityStatus = "available" | "unavailable" | "booked";

export type OwnerAvailabilityPeriod = {
  periodType: BookingPeriodType;
  label: string;
  time?: string;
  status: OwnerPeriodAvailabilityStatus;
};

export type OwnerAvailabilityDay = {
  dateIso: string;
  dateLabel: string;
  periods: OwnerAvailabilityPeriod[];
};

export type OwnerAvailabilityPeriodUpdate = {
  hallId: string;
  dateIso: string;
  periodType: BookingPeriodType;
  status: OwnerPeriodAvailabilityStatus;
  label?: string;
  time?: string;
};

export type OwnerAvailabilityLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "error";
