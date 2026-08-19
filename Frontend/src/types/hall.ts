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

export const DEFAULT_HALL_AMENITIES: HallAmenity[] = [
  { id: "ac", label: "تكييف مركزي", icon: "ac" },
  { id: "parking", label: "موقف VIP", icon: "parking" },
  { id: "sound", label: "نظام صوت متطور", icon: "sound" },
  { id: "dressing", label: "غرفة تجهيز", icon: "dressing" },
];

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
