import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { fromHallRegionApi } from "@/lib/hall-owner-api-region";
import type { HallRegion } from "@/constants/hallRegions";

/**
 * Hall form catalogs (wesal-api US-HALL).
 *
 * GET /api/v1/halls/catalog/addresses  → RegionAddressCatalogDto[]
 * GET /api/v1/halls/catalog/features   → { features: string[] }
 *
 * Both require an authenticated Bearer token.
 */
export const REGION_ADDRESS_CATALOG_PATH = "/halls/catalog/addresses";
export const FEATURE_CATALOG_PATH = "/halls/catalog/features";

export type RegionAddresses = {
  region: HallRegion;
  /** Backend HallRegion enum value (display name is derived client-side from i18n). */
  regionApi: string;
  addresses: string[];
};

type RegionAddressDto = {
  region?: string | number | null;
  regionDisplayName?: string | null;
  addresses?: unknown;
  Addresses?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const list: string[] = [];
  for (const item of raw) {
    const text = asText(item);
    if (text) list.push(text);
  }
  return list;
}

export function mapRegionAddresses(data: unknown): RegionAddresses[] {
  if (!Array.isArray(data)) return [];
  const regions: RegionAddresses[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const dto = item as RegionAddressDto;
    const raw = dto.region;
    const addresses = asStringList(dto.addresses ?? dto.Addresses);
    const mapped = fromHallRegionApi(raw);
    if (!mapped) continue;
    regions.push({
      region: mapped,
      regionApi: String(raw ?? "").trim(),
      addresses,
    });
  }
  return regions;
}

export function mapFeatureCatalog(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const dto = data as { features?: unknown; Features?: unknown };
  return asStringList(dto.features ?? dto.Features);
}

/**
 * Mirrors the backend HallFeatureCatalog canonical Arabic feature names. Used ONLY as
 * the demo/stub-token fallback so the Add/Edit form stays usable offline; live tokens
 * always use the backend catalog endpoint as the source of truth.
 */
export const DEFAULT_FEATURE_CATALOG: string[] = [
  "مولد كهرباء",
  "كهرباء متواصلة",
  "تكييف",
  "مراوح",
  "جلسة للرجال",
  "جلسة للنساء",
  "إنترنت (واي فاي)",
  "ميكرفون ومكبر صوت",
  "كراسي جاهزة",
  "طاولات",
  "موقف سيارات",
  "مظلات خارجية",
];

function usesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/**
 * Fetches the dependent Region → address list + the predefined feature catalog.
 * Both are static catalogs; the store caches them for the session.
 */
export async function fetchHallCatalogs(): Promise<{
  addressesByRegion: Partial<Record<HallRegion, string[]>>;
  features: string[];
}> {
  const addressesByRegion: Partial<Record<HallRegion, string[]>> = {};
  const features: string[] = [];

  if (usesMock()) {
    features.push(...DEFAULT_FEATURE_CATALOG);
    return { addressesByRegion, features };
  }

  try {
    const { data } = await api.get<unknown>(REGION_ADDRESS_CATALOG_PATH, {
      timeout: 10000,
    });
    for (const region of mapRegionAddresses(data)) {
      addressesByRegion[region.region] = region.addresses;
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    // Unavailable catalog degrades to free-text address entry; do not block the form.
  }

  try {
    const { data } = await api.get<unknown>(FEATURE_CATALOG_PATH, {
      timeout: 10000,
    });
    features.push(...mapFeatureCatalog(data));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    if (features.length === 0) {
      features.push(...DEFAULT_FEATURE_CATALOG);
    }
  }

  return { addressesByRegion, features };
}