import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import {
  findHallDetailsFallback,
  getHallDetailsFallback,
  HALL_DETAILS_FALLBACK,
} from "@/constants/hallDetailsFallback";
import { getDefaultHallAmenities } from "@/lib/amenities";
import {
  REGION_API_PARAMS,
  type FeaturedHall,
  type HallAmenity,
  type HallAvailabilityDay,
  type HallBookingPeriodFilter,
  type HallDayPeriod,
  type HallDetail,
  type HallDetails,
  type HallDetailsLoadResult,
  type HallRegion,
  type HallReview,
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
    return t("halls.period.first");
  }
  if (name?.includes("Second") || typeValue === 1 || typeValue === "secondperiod") {
    return t("halls.period.second");
  }
  return name ?? t("halls.period.generic");
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
          : t("errors.offlineDemo"),
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
        label: t("halls.period.morning"),
        price: hall.morningPrice,
        priceLabel: formatPriceAmount(hall.morningPrice),
      });
    }
    if (hall.eveningPrice != null) {
      slots.push({
        label: t("halls.period.evening"),
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
        label: t("halls.period.morning"),
        price: hall.price,
        priceLabel: formatPriceAmount(hall.price),
      },
      {
        label: t("halls.period.evening"),
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
            : t("errors.offlineDemo"),
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

/**
 * All approved halls for the catalog page (US-LAND-06).
 * GET /v1/halls, then GET /v1/halls/search if the listing route is missing.
 */
export async function fetchCatalogHalls(): Promise<FeaturedHallsLoadResult> {
  const load = async (path: string) => {
    const { data } = await api.get<FeaturedResponse>(path, { timeout: 8000 });
    return {
      halls: normalize(data).map(mapApiHall),
      source: "api" as const,
    };
  };

  try {
    return await load("/halls");
  } catch {
    try {
      return await load("/halls/search");
    } catch (err) {
      return {
        halls: FEATURED_HALLS_FALLBACK,
        source: "fallback",
        error:
          err instanceof Error
            ? err.message
            : t("errors.offlineHalls"),
      };
    }
  }
}

export type HallSearchFilters = {
  name?: string;
  area?: string;
  region?: HallRegion;
  date?: string;
  period?: HallBookingPeriodFilter;
};

export function filterCatalogHalls(
  halls: FeaturedHall[],
  filters: HallSearchFilters,
): FeaturedHall[] {
  const name = filters.name?.trim() ?? "";
  const area = filters.area?.trim() ?? "";
  const region = filters.region ?? "all";
  const date = filters.date?.trim() ?? "";
  const period = filters.period ?? "all";

  if (getPastSearchDateMessage(date)) return [];

  return halls.filter((hall) => {
    if (name && !includesLoose(hall.name, name)) return false;
    if (area && !includesLoose(hall.location, area)) return false;
    if (region !== "all" && hall.region !== region) return false;
    if (!matchesDateAndPeriod(hall, date, period)) return false;
    return true;
  });
}

/** GET /v1/halls/search — falls back so the catalog can still filter locally. */
export async function fetchSearchHalls(
  filters: HallSearchFilters,
): Promise<FeaturedHallsLoadResult> {
  const params: Record<string, string> = {};
  if (filters.name?.trim()) params.name = filters.name.trim();
  if (filters.area?.trim()) params.area = filters.area.trim();
  if (filters.region && filters.region !== "all") {
    params.region = REGION_API_PARAMS[filters.region];
  }
  const dateIso = filters.date?.trim()
    ? parseTypedDateToIso(filters.date)
    : null;
  if (dateIso) params.date = dateIso;
  if (filters.period === "first") params.period = "FirstPeriod";
  if (filters.period === "second") params.period = "SecondPeriod";

  try {
    const { data } = await api.get<FeaturedResponse>("/halls/search", {
      params,
      timeout: 8000,
    });
    return {
      halls: normalize(data).map(mapApiHall),
      source: "api",
    };
  } catch (err) {
    return {
      halls: [],
      source: "fallback",
      error:
        err instanceof Error ? err.message : t("errors.searchFallback"),
    };
  }
}

function includesLoose(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function matchesPeriodLabel(label: string, period: "first" | "second") {
  const value = label.toLowerCase();
  if (period === "first") {
    return label.includes("الأولى") || value.includes("first");
  }
  return label.includes("الثانية") || value.includes("second");
}

function parseTypedDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }

  return null;
}

export function getPastSearchDateMessage(value: string): string | null {
  const iso = parseTypedDateToIso(value);
  if (!iso) return null;

  const [year, month, day] = iso.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  const today = new Date();
  selected.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (selected >= today) return null;

  return t("halls.catalog.pastDate");
}

function dayMatchesIso(day: HallAvailabilityDay, iso: string) {
  if (day.dateIso === iso) return true;
  return day.dateLabel === formatDateLabel(iso);
}

function dayMatchesQuery(day: HallAvailabilityDay, query: string) {
  if (includesLoose(day.dateLabel, query)) return true;
  if (day.dateIso && includesLoose(day.dateIso, query)) return true;

  const iso = parseTypedDateToIso(query);
  if (!iso) return false;
  return dayMatchesIso(day, iso);
}

function matchesDateAndPeriod(
  hall: FeaturedHall,
  dateQuery: string,
  period: HallBookingPeriodFilter,
) {
  if (!dateQuery && period === "all") return true;

  const days = hall.availabilityDays ?? [];
  if (days.length === 0) return false;

  const relevant = dateQuery
    ? days.filter((day) => dayMatchesQuery(day, dateQuery))
    : days;
  if (dateQuery && relevant.length === 0) return false;

  return relevant.some((day) =>
    day.periods.some((item) => {
      if (item.status !== "available") return false;
      if (period === "all") return true;
      return matchesPeriodLabel(item.label, period);
    }),
  );
}

type ApiHallDetails = {
  hallId?: string;
  id?: string;
  hallName?: string;
  name?: string;
  mainImage?: string | null;
  mainImageUrl?: string | null;
  imageUrl?: string | null;
  images?: Array<string | { url?: string; imageUrl?: string }>;
  gallery?: Array<string | { url?: string; imageUrl?: string }>;
  region?: string;
  address?: string;
  location?: string;
  capacity?: number;
  capacityMax?: number | null;
  price?: number | null;
  priceLabel?: string | null;
  showPrice?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  description?: string | null;
  shortDescription?: string | null;
  amenities?: Array<{
    id?: string;
    label?: string;
    name?: string;
    icon?: HallAmenity["icon"];
  }>;
  reviews?: Array<{
    id?: string;
    author?: string;
    userName?: string;
    rating?: number;
    comment?: string;
    text?: string;
    timeAgo?: string;
    createdAt?: string;
  }>;
  status?: string | number;
  isAvailable?: boolean;
  isDeleted?: boolean;
  isOwner?: boolean;
};

type HallDetailsResponse = ApiHallDetails | { data: ApiHallDetails };

export type HallByIdLoadResult =
  | {
      status: "ok";
      hall: HallDetails;
      source: "api" | "fallback";
      warning?: string;
    }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

const UNAVAILABLE_STATUSES = new Set([
  "pending",
  "pendingreview",
  "rejected",
  "locked",
  "deleted",
  "unavailable",
]);

function getDefaultAmenities(): HallAmenity[] {
  return getDefaultHallAmenities();
}

function unwrapHallDetails(payload: HallDetailsResponse): ApiHallDetails {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data ?? {};
  }
  return payload;
}

function mapImageEntry(
  entry: string | { url?: string; imageUrl?: string } | null | undefined,
  index: number,
): string | null {
  if (!entry) return null;
  if (typeof entry === "string") return resolveHallImage(entry, index);
  return resolveHallImage(entry.url ?? entry.imageUrl, index);
}

function isHallUnavailable(raw: ApiHallDetails): boolean {
  if (raw.isAvailable === false || raw.isDeleted === true) return true;
  if (raw.status == null) return false;
  if (typeof raw.status === "number") return raw.status !== 1;
  const normalized = raw.status.toLowerCase().replace(/[\s_-]/g, "");
  if (normalized === "approved" || normalized === "available") return false;
  return UNAVAILABLE_STATUSES.has(normalized) || normalized !== "approved";
}

function mapAmenities(
  raw?: ApiHallDetails["amenities"],
  fallback?: HallAmenity[],
): HallAmenity[] {
  const defaults = getDefaultAmenities();
  if (!raw?.length) return fallback ?? defaults;
  return raw.map((item, index) => ({
    id: item.id ?? `amenity-${index}`,
    label: item.label ?? item.name ?? t("common.amenity"),
    icon: item.icon ?? defaults[index % defaults.length].icon,
  }));
}

function mapReviews(
  raw?: ApiHallDetails["reviews"],
  fallback?: HallReview[],
): HallReview[] {
  if (!raw?.length) return fallback ?? [];
  return raw.map((item, index) => ({
    id: item.id ?? `review-${index}`,
    author: item.author ?? item.userName ?? t("common.user"),
    rating: item.rating ?? 5,
    comment: item.comment ?? item.text ?? "",
    timeAgo: item.timeAgo ?? item.createdAt ?? "",
  }));
}

function mapApiHallDetails(raw: ApiHallDetails): HallDetails {
  const fallback = findHallDetailsFallback(String(raw.hallId ?? raw.id ?? ""));
  const id = String(raw.hallId ?? raw.id ?? fallback?.id ?? "");
  const galleryRaw = raw.images ?? raw.gallery ?? [];
  const gallery = galleryRaw
    .map((entry, index) => mapImageEntry(entry, index))
    .filter((url): url is string => Boolean(url));
  const main = resolveHallImage(
    raw.mainImage ?? raw.mainImageUrl ?? raw.imageUrl,
    0,
  );
  const images = Array.from(
    new Set([main, ...gallery, ...(fallback?.images ?? [])].filter(Boolean)),
  );
  const priceLabel =
    raw.showPrice === false
      ? null
      : (raw.priceLabel ??
        (raw.price != null ? `${raw.price} / يوم` : fallback?.priceLabel));

  return {
    id,
    name: raw.hallName ?? raw.name ?? fallback?.name ?? t("common.hall"),
    location: raw.address ?? raw.location ?? fallback?.location ?? "",
    region: raw.region ? mapApiRegion(raw.region) : (fallback?.region ?? "gaza"),
    capacity: raw.capacity ?? fallback?.capacity ?? 0,
    capacityMax: raw.capacityMax ?? fallback?.capacityMax ?? null,
    priceLabel,
    rating: raw.rating ?? fallback?.rating ?? null,
    reviewCount: raw.reviewCount ?? fallback?.reviewCount ?? null,
    description:
      raw.description ?? raw.shortDescription ?? fallback?.description ?? null,
    amenities: mapAmenities(raw.amenities, fallback?.amenities),
    reviews: mapReviews(raw.reviews, fallback?.reviews),
    images: images.length > 0 ? images : (fallback?.images ?? [main]),
    isAvailable: !isHallUnavailable(raw),
    isOwner: raw.isOwner ?? false,
    availabilityDays: fallback?.availabilityDays ?? [],
  };
}

/**
 * US-LAND-04 — GET /v1/halls/:id for the hall details modal.
 */
export async function fetchHallById(id: string): Promise<HallByIdLoadResult> {
  const hallId = String(id).trim();
  if (!hallId) {
    return { status: "unavailable", message: t("errors.hallInvalid") };
  }

  try {
    const { data } = await api.get<HallDetailsResponse>(`/halls/${hallId}`, {
      timeout: 2500,
    });
    const hall = mapApiHallDetails(unwrapHallDetails(data));
    if (!hall.isAvailable) {
      return {
        status: "unavailable",
        message: t("errors.hallUnavailable"),
      };
    }
    return { status: "ok", hall, source: "api" };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : undefined;
    const message =
      err instanceof Error ? err.message : t("errors.hallLoad");
    const local = findHallDetailsFallback(hallId);

    if (status === 404 || status === 410) {
      if (local) {
        return {
          status: "ok",
          hall: local,
          source: "fallback",
          warning: t("errors.offlineDemo"),
        };
      }
      return {
        status: "unavailable",
        message: t("errors.hallMissing"),
      };
    }

    if (local) {
      return {
        status: "ok",
        hall: local,
        source: "fallback",
        warning: t("halls.details.offline"),
      };
    }

    return { status: "error", message };
  }
}
