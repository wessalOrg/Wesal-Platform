import api from "@/lib/api";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import {
  REGION_API_PARAMS,
  type FeaturedHall,
  type HallAvailabilityDay,
  type HallDayPeriod,
  type HallRegion,
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
  price?: number | null;
  priceLabel?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  shortDescription?: string | null;
  tags?: string[];
  availability?: ApiAvailabilityDay[];
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
