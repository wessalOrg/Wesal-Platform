/**
 * Hall region values accepted by the backend (display strings).
 * Do not rename/translate these constants — they are API contract values.
 * UI labels come from i18n via HALL_REGION_LABEL_KEYS.
 */
export const HALL_REGIONS = [
  "North Gaza",
  "Gaza",
  "Middle Area",
  "South Gaza",
] as const;

export type HallRegion = (typeof HALL_REGIONS)[number];

export const HALL_REGION_LABEL_KEYS: Record<HallRegion, string> = {
  "North Gaza": "region.north",
  Gaza: "region.gaza",
  "Middle Area": "region.middle",
  "South Gaza": "region.south",
};

export function isHallRegion(value: string): value is HallRegion {
  return (HALL_REGIONS as readonly string[]).includes(value);
}
