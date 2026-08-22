import { t } from "@/i18n";
import type { HallAmenity } from "@/types/hall";

/** Amenity ids + icons only — labels come from i18n at call time. */
export const DEFAULT_HALL_AMENITY_DEFS = [
  { id: "ac", icon: "ac" as const, key: "amenity.ac" },
  { id: "parking", icon: "parking" as const, key: "amenity.parking" },
  { id: "sound", icon: "sound" as const, key: "amenity.sound" },
  { id: "dressing", icon: "dressing" as const, key: "amenity.dressing" },
] as const;

/** Resolve default hall amenities with localized labels (call at runtime). */
export function getDefaultHallAmenities(): HallAmenity[] {
  return DEFAULT_HALL_AMENITY_DEFS.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: t(item.key),
  }));
}
