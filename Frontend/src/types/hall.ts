import type { BookingPeriodType } from "@/types/booking";

export type HallRegion =
  | "all"
  | "north"
  | "gaza"
  | "middle"
  | "south";

export type PeriodStatus = "available" | "booked";

export type { BookingPeriodType };

export type HallDayPeriod = {
  periodType?: BookingPeriodType;
  label: string;
  time?: string;
  status: PeriodStatus;
};

export type HallAvailabilityDay = {
  dateLabel: string;
  dateIso?: string;
  periods: HallDayPeriod[];
};

export type HallBookingPeriodFilter = "all" | "first" | "second";

export type FeaturedHall = {
  id: string;
  name: string;
  imageUrl: string;
  priceLabel?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  location: string;
  capacity: number;
  capacityMax?: number | null;
  tags?: string[];
  region: Exclude<HallRegion, "all">;
  /** Short card label, e.g. "15 August · الفترة الأولى" */
  bookedPeriodsSummary?: string | null;
  /** Day + 2 periods with Booked/Available — shown in popup */
  availabilityDays?: HallAvailabilityDay[];
};

export type HallAmenity = {
  id: string;
  label: string;
  icon: "ac" | "sound" | "parking" | "dressing";
};

export type HallReview = {
  id: string;
  author: string;
  rating?: number | null;
  comment: string;
  timeAgo: string;
};

export type HallDetails = {
  id: string;
  name: string;
  location: string;
  region: Exclude<HallRegion, "all">;
  capacity: number;
  capacityMax?: number | null;
  priceLabel?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  description?: string | null;
  amenities: HallAmenity[];
  reviews: HallReview[];
  images: string[];
  isAvailable: boolean;
  isOwner?: boolean;
  availabilityDays?: HallAvailabilityDay[];
};

export const REGION_OPTIONS: { id: HallRegion; labelKey: string }[] = [
  { id: "all", labelKey: "region.all" },
  { id: "north", labelKey: "region.north" },
  { id: "gaza", labelKey: "region.gaza" },
  { id: "middle", labelKey: "region.middle" },
  { id: "south", labelKey: "region.south" },
];

/** Backend HallRegion enum query values */
export const REGION_API_PARAMS: Record<Exclude<HallRegion, "all">, string> = {
  north: "NorthGaza",
  gaza: "Gaza",
  middle: "MiddleArea",
  south: "SouthGaza",
};

export type HallSlotPrice = {
  label: string;
  time?: string;
  price: number | null;
  priceLabel?: string | null;
};

export type BookingSelection = {
  dateIso: string;
  dateLabel: string;
  periods: BookingPeriodType[];
};

export type HallDetail = {
  id: string;
  name: string;
  description: string;
  location: string;
  region: Exclude<HallRegion, "all">;
  capacity: number;
  capacityMax?: number | null;
  amenities: string[];
  gallery: string[];
  mainImageUrl: string;
  slotPrices: HallSlotPrice[];
  ownerPhone?: string | null;
  isActive: boolean;
  /** Server-side ownership for the current token (`HallDetailsDto.IsOwner`). */
  isOwner?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  availabilityDays?: HallAvailabilityDay[];
};

export type HallDetailsLoadResult =
  | { status: "success"; hall: HallDetail; source: "api" }
  | { status: "unavailable"; hall: HallDetail; source: "api" | "fallback" }
  | { status: "not_found"; source: "api" | "fallback" }
  | { status: "error"; error: string; source: "fallback"; hall?: HallDetail };
