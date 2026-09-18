import type { HallRegion } from "@/constants/hallRegions";
import { isHallRegion } from "@/constants/hallRegions";

/** Backend HallRegion enum JSON values (JsonStringEnumConverter). */
export type HallRegionApi =
  | "NorthGaza"
  | "Gaza"
  | "MiddleArea"
  | "SouthGaza";

const UI_TO_API: Record<HallRegion, HallRegionApi> = {
  "North Gaza": "NorthGaza",
  Gaza: "Gaza",
  "Middle Area": "MiddleArea",
  "South Gaza": "SouthGaza",
};

/** Maps UI display region → backend enum string for UpdateOwnerHallRequest. */
export function toHallRegionApi(region: HallRegion | ""): HallRegionApi | null {
  if (!region || !isHallRegion(region)) return null;
  return UI_TO_API[region];
}

/** Maps backend Region / RegionDisplayName → UI display string. */
export function fromHallRegionApi(raw: string | number | null | undefined): HallRegion | "" {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "number") {
    if (raw === 0) return "North Gaza";
    if (raw === 1) return "Gaza";
    if (raw === 2) return "Middle Area";
    if (raw === 3) return "South Gaza";
    return "";
  }
  if (isHallRegion(raw)) return raw;
  const normalized = raw.replace(/[\s_-]/g, "").toLowerCase();
  if (normalized === "northgaza") return "North Gaza";
  if (normalized === "gaza") return "Gaza";
  if (normalized === "middlearea") return "Middle Area";
  if (normalized === "southgaza") return "South Gaza";
  return "";
}

/** Absolute media URL for relative `/uploads/...` paths from wesal-api. */
export function resolveOwnerMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/i, "");
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

/** TimeOnly-compatible string (HH:mm:ss) for UpdateOwnerHallRequest. */
export function toTimeOnlyApi(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return trimmed;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}
