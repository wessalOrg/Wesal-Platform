import api from "@/lib/api";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import {
  getHallDetailsFallback,
  HALL_DETAILS_FALLBACK,
} from "@/constants/hallDetailsFallback";
import {
  REGION_API_PARAMS,
  type FeaturedHall,
  type HallAvailabilityDay,
  type HallDayPeriod,
  type HallDetail,
  type HallDetailsLoadResult,
  type HallRegion,
  type HallSlotPrice,
  type PeriodStatus,
} from "@/types/hall";

const LOCAL_HALL_IMAGES = [
  "/halls/featured-lotus.webp",
  "/halls/featured-02.webp",
  "/halls/featured-03.webp",
  "/halls/featured-04.webp",
  "/halls/featured-05.webp",
  "/halls/featured-06.webp",
];

type ApiPeriod = {
  periodType?: number | string;
  periodName?: string;
  startTime?: string;
  endTime?: string;
  status?: number | string;
  price?: number | null;
};

type ApiAvailabilityDay = {
  date?: string;
  periods?: ApiPeriod[];
};

type ApiFeaturedHall = {
  hallId?: string;
  id?: string;
  hallName?: string;
  name?: string;
  mainImage?: string | null;
  imageUrl?: string;
  region?: string;
  address?: string;
  location?: string;
  capacity?: number;
  capacityMax?: number | null;
  price?: number | null;
  morningPrice?: number | null;
  eveningPrice?: number | null;
  priceLabel?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  tags?: string[];
  amenities?: string[];
  gallery?: string[];
  images?: string[];
  contactPhone?: string | null;
  ownerPhone?: string | null;
  status?: number | string;
  isActive?: boolean;
  availability?: ApiAvailabilityDay[];
  bookingPeriods?: ApiPeriod[];
};

type FeaturedResponse = ApiFeaturedHall[] | { data: ApiFeaturedHall[] };

export type FeaturedHallsLoadResult = {
  halls: FeaturedHall[];
  source: "api" | "fallback";
  error?: string;
};

function resolveHallImage(
  apiImage: string | null | undefined,
  index: number,
): string {
  const fallback = LOCAL_HALL_IMAGES[index % LOCAL_HALL_IMAGES.length];
  const value = apiImage?.trim();
  if (!value) return fallback;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  ) {
    return value;
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/i, "");
  return `${origin}/${value.replace(/^\//, "")}`;
}

function normalize(payload: FeaturedResponse): ApiFeaturedHall[] {
  if (Array.isArray(payload)) return payload;
  return payload.data ?? [];
}

function mapApiRegion(region?: string): Exclude<HallRegion, "all"> {
  const value = region?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (value.includes("north")) return "north";
  if (value.includes("middle")) return "middle";
  if (value.includes("south")) return "south";
  return "gaza";
}

function toPeriodStatus(status?: number | string): PeriodStatus {
  if (status == null) return "available";
  if (typeof status === "number") return status === 1 ? "booked" : "available";
  const normalized = status.toLowerCase();
  return normalized === "booked" || normalized === "1" ? "booked" : "available";
}

function formatDateLabel(date?: string): string {
  if (!date) return "";
  try {
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return date;
  }
}

function formatTimeRange(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  return `${String(start).slice(0, 5)} – ${String(end).slice(0, 5)}`;
}

function mapPeriodLabel(name?: string, type?: number | string): string {
  const typeValue = typeof type === "string" ? type.toLowerCase() : type;
  if (name?.includes("First") || typeValue === 0 || typeValue === "firstperiod") {
    return "الفترة الأولى";
  }
  if (name?.includes("Second") || typeValue === 1 || typeValue === "secondperiod") {
    return "الفترة الثانية";
  }
  return name ?? "فترة";
}

function mapAvailabilityDays(
  availability?: ApiAvailabilityDay[],
): HallAvailabilityDay[] {
  if (!availability?.length) return [];

  return availability.slice(0, 7).map((day) => ({
    dateLabel: formatDateLabel(day.date),
    periods: (day.periods ?? []).map(
      (period): HallDayPeriod => ({
        label: mapPeriodLabel(period.periodName, period.periodType),
        time: formatTimeRange(period.startTime, period.endTime),
        status: toPeriodStatus(period.status),
      }),
    ),
  }));
}

function summarizeBooked(days: HallAvailabilityDay[]): string | null {
  for (const day of days) {
    const booked = day.periods.find((period) => period.status === "booked");
    if (booked) {
      return `${day.dateLabel} · ${booked.label}`;
    }
  }
  return null;
}

function mapApiHall(hall: ApiFeaturedHall, index: number): FeaturedHall {
  const fallback = FEATURED_HALLS_FALLBACK[index % FEATURED_HALLS_FALLBACK.length];
  const id = hall.hallId ?? hall.id ?? fallback.id;
  const name = hall.hallName ?? hall.name ?? fallback.name;
  const location = hall.address ?? hall.location ?? fallback.location;
  const availabilityDays =
    mapAvailabilityDays(hall.availability).length > 0
      ? mapAvailabilityDays(hall.availability)
      : (fallback.availabilityDays ?? []);

  return {
    id: String(id),
    name,
    imageUrl: resolveHallImage(hall.mainImage ?? hall.imageUrl, index),
    priceLabel:
      hall.priceLabel ??
      (hall.price != null ? `${hall.price} / يوم` : fallback.priceLabel),
    rating: hall.rating ?? fallback.rating,
    reviewCount: hall.reviewCount ?? fallback.reviewCount,
    location,
    capacity: hall.capacity ?? fallback.capacity,
    capacityMax: fallback.capacityMax ?? null,
    tags: hall.tags ?? fallback.tags,
    region: hall.region ? mapApiRegion(hall.region) : fallback.region,
    bookedPeriodsSummary:
      summarizeBooked(availabilityDays) ?? fallback.bookedPeriodsSummary ?? null,
    availabilityDays,
  };
}

/** Local-only filter used when API is unavailable (fallback mode). */
export function filterFeaturedByRegion(
  halls: FeaturedHall[],
  region: HallRegion,
): FeaturedHall[] {
  if (region === "all") return halls.slice(0, 6);
  return halls.filter((hall) => hall.region === region).slice(0, 6);
}

/**
 * Featured approved halls (US-LAND-02 / region filter).
 * GET /v1/halls/featured?region=Gaza
 */
export async function fetchFeaturedHalls(
  region: HallRegion = "all",
): Promise<FeaturedHallsLoadResult> {
  try {
    const params =
      region === "all" ? undefined : { region: REGION_API_PARAMS[region] };

    const { data } = await api.get<FeaturedResponse>("/halls/featured", {
      params,
      timeout: 8000,
    });
    const raw = normalize(data).slice(0, 6);
    return {
      halls: raw.map(mapApiHall),
      source: "api",
    };
  } catch (err) {
    return {
      halls: FEATURED_HALLS_FALLBACK.slice(0, 6),
      source: "fallback",
      error:
        err instanceof Error
          ? err.message
          : "تعذر الاتصال بالخادم. يتم عرض بيانات تجريبية.",
    };
  }
}

function formatPriceAmount(value: number): string {
  return `${value.toLocaleString("en-US")} ₪`;
}

function mapSlotPrices(hall: ApiFeaturedHall, index: number): HallSlotPrice[] {
  const fallback = getHallDetailsFallback(String(hall.hallId ?? hall.id ?? "")) ??
    HALL_DETAILS_FALLBACK["1"];

  if (hall.morningPrice != null || hall.eveningPrice != null) {
    const slots: HallSlotPrice[] = [];
    if (hall.morningPrice != null) {
      slots.push({
        label: "الفترة الصباحية",
        price: hall.morningPrice,
        priceLabel: formatPriceAmount(hall.morningPrice),
      });
    }
    if (hall.eveningPrice != null) {
      slots.push({
        label: "الفترة المسائية",
        price: hall.eveningPrice,
        priceLabel: formatPriceAmount(hall.eveningPrice),
      });
    }
    if (slots.length) return slots;
  }

  if (hall.bookingPeriods?.length) {
    return hall.bookingPeriods.map((period) => ({
      label: mapPeriodLabel(period.periodName, period.periodType),
      time: formatTimeRange(period.startTime, period.endTime),
      price: period.price ?? hall.price ?? null,
      priceLabel:
        period.price != null
          ? formatPriceAmount(period.price)
          : hall.price != null
            ? formatPriceAmount(hall.price)
            : null,
    }));
  }

  if (hall.price != null) {
    return [
      {
        label: "الفترة الصباحية",
        price: hall.price,
        priceLabel: formatPriceAmount(hall.price),
      },
      {
        label: "الفترة المسائية",
        price: hall.price,
        priceLabel: formatPriceAmount(hall.price),
      },
    ];
  }

  return fallback?.slotPrices ?? [];
}

function resolveGalleryImages(
  hall: ApiFeaturedHall,
  mainImage: string,
  index: number,
): string[] {
  const raw = [...(hall.gallery ?? []), ...(hall.images ?? [])]
    .map((item) => item?.trim())
    .filter(Boolean) as string[];

  const resolved = raw.map((item, imageIndex) =>
    resolveHallImage(item, index + imageIndex),
  );

  const unique = Array.from(new Set([mainImage, ...resolved]));
  return unique.filter(Boolean);
}

function isHallActive(hall: ApiFeaturedHall): boolean {
  if (hall.isActive === false) return false;
  if (hall.status == null) return true;
  if (typeof hall.status === "number") return hall.status === 1;
  const normalized = hall.status.toLowerCase();
  return normalized === "approved" || normalized === "active" || normalized === "1";
}

function mapApiHallDetail(hall: ApiFeaturedHall, index: number): HallDetail {
  const id = String(hall.hallId ?? hall.id ?? "");
  const fallback = getHallDetailsFallback(id) ?? HALL_DETAILS_FALLBACK["1"];
  const mainImageUrl = resolveHallImage(hall.mainImage ?? hall.imageUrl, index);
  const availabilityDays =
    mapAvailabilityDays(hall.availability).length > 0
      ? mapAvailabilityDays(hall.availability)
      : (fallback.availabilityDays ?? []);

  return {
    id,
    name: hall.hallName ?? hall.name ?? fallback.name,
    description:
      hall.description ??
      hall.shortDescription ??
      fallback.description,
    location: hall.address ?? hall.location ?? fallback.location,
    region: hall.region ? mapApiRegion(hall.region) : fallback.region,
    capacity: hall.capacity ?? fallback.capacity,
    capacityMax: hall.capacityMax ?? fallback.capacityMax ?? null,
    amenities: hall.amenities ?? hall.tags ?? fallback.amenities,
    gallery: resolveGalleryImages(hall, mainImageUrl, index),
    mainImageUrl,
    slotPrices: mapSlotPrices(hall, index),
    ownerPhone: hall.contactPhone ?? hall.ownerPhone ?? fallback.ownerPhone ?? null,
    isActive: isHallActive(hall),
    rating: hall.rating ?? fallback.rating ?? null,
    reviewCount: hall.reviewCount ?? fallback.reviewCount ?? null,
    availabilityDays,
  };
}

type HallDetailResponse = ApiFeaturedHall | { data: ApiFeaturedHall };

function normalizeDetail(payload: HallDetailResponse): ApiFeaturedHall {
  if ("data" in payload && payload.data) return payload.data;
  return payload as ApiFeaturedHall;
}

/**
 * Public hall details (US-LAND-04).
 * GET /v1/halls/{id}
 */
export async function fetchHallDetails(id: string): Promise<HallDetailsLoadResult> {
  const fallback = getHallDetailsFallback(id);

  try {
    const { data } = await api.get<HallDetailResponse>(`/halls/${id}`, {
      timeout: 8000,
    });
    const raw = normalizeDetail(data);
    const hall = mapApiHallDetail(raw, 0);

    if (!hall.isActive) {
      return { status: "unavailable", hall, source: "api" };
    }

    return { status: "success", hall, source: "api" };
  } catch (err) {
    if (fallback) {
      if (!fallback.isActive) {
        return { status: "unavailable", hall: fallback, source: "fallback" };
      }

      return {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "تعذر الاتصال بالخادم. يتم عرض بيانات تجريبية.",
        source: "fallback",
        hall: fallback,
      };
    }

    return {
      status: "not_found",
      source: "api",
    };
  }
}
