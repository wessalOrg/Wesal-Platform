export type HallRegion =
  | "all"
  | "north"
  | "gaza"
  | "middle"
  | "south";

export type PeriodStatus = "available" | "booked";

export type HallDayPeriod = {
  label: string;
  time?: string;
  status: PeriodStatus;
};

export type HallAvailabilityDay = {
  dateLabel: string;
  periods: HallDayPeriod[];
};

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

export const REGION_OPTIONS: { id: HallRegion; label: string }[] = [
  { id: "all", label: "جميع المناطق" },
  { id: "north", label: "شمال غزة" },
  { id: "gaza", label: "غزة" },
  { id: "middle", label: "المنطقة الوسطى" },
  { id: "south", label: "جنوب غزة" },
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
  dateLabel: string;
  periodLabel: string;
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
  rating?: number | null;
  reviewCount?: number | null;
  availabilityDays?: HallAvailabilityDay[];
};

export type HallDetailsLoadResult =
  | { status: "success"; hall: HallDetail; source: "api" }
  | { status: "unavailable"; hall: HallDetail; source: "api" | "fallback" }
  | { status: "not_found"; source: "api" | "fallback" }
  | { status: "error"; error: string; source: "fallback"; hall?: HallDetail };
