import type { HallRegion as OwnerHallRegion } from "@/constants/hallRegions";
import type { HallRegion } from "@/types/hall";

/**
 * Mirrors Backend RegionAddressCatalog so guests can filter without
 * GET /halls/catalog/addresses (that route requires auth).
 */
export const DEFAULT_ADDRESSES_BY_OWNER_REGION: Record<OwnerHallRegion, string[]> = {
  "North Gaza": ["جباليا", "بيت حانون", "بيت لاهيا", "النزلة", "عزبة بيت حانون"],
  Gaza: [
    "حي الشجاعية",
    "حي الزيتون",
    "حي الدرج والتفاح",
    "حي الشيخ رضوان",
    "حي الرمال",
    "تل الهوى",
    "النصر",
    "الكرامة",
    "جحر الديك",
    "مخيم الشاطئ",
    "حي الصبرة",
    "حي الشيخ عجلين",
    "حي المقوسي",
    "منطقة اليرموك",
    "أنصار والكتيبة",
    "حي تل المنطار",
    "السدرة",
    "الساحة",
    "عسقولة",
    "الزهراء",
    "المغراقة",
    "الجلاء",
  ],
  "Middle Area": ["المصدر", "النصيرات", "دير البلح", "المغازي"],
  "South Gaza": [
    "منطقة البلد (المركز)",
    "مخيم خان يونس",
    "حي الأمل",
    "حي الكتيبة",
    "حي المحطة",
    "بني سهيلا",
    "عبسان الكبيرة",
    "عبسان الجديدة (الصغيرة)",
    "خزاعة",
    "الفخاري",
    "القرارة",
    "حي السطر (السطر الشرقي)",
    "حي السطر (السطر الغربي)",
    "منطقة المواصي",
    "حي الشيخ ناصر",
    "حي جورة العقاد",
    "حي معن",
    "حي المنارة",
    "حي قيزان النجار",
    "حي قيزان أبو رشوان",
    "حي بطن السمين",
    "حي السلام",
    "مدينة حمد بن خليفة آل ثاني السكنية",
  ],
};

export const CATALOG_REGION_TO_OWNER: Record<Exclude<HallRegion, "all">, OwnerHallRegion> = {
  north: "North Gaza",
  gaza: "Gaza",
  middle: "Middle Area",
  south: "South Gaza",
};

function addressesForOwnerRegion(
  ownerRegion: OwnerHallRegion,
  overlay?: Partial<Record<OwnerHallRegion, string[]>>,
): string[] {
  const live = overlay?.[ownerRegion];
  if (live && live.length > 0) return live;
  return DEFAULT_ADDRESSES_BY_OWNER_REGION[ownerRegion] ?? [];
}

export function addressesForCatalogRegion(
  region: HallRegion,
  overlay?: Partial<Record<OwnerHallRegion, string[]>>,
): string[] {
  if (region === "all") return [];

  return addressesForOwnerRegion(CATALOG_REGION_TO_OWNER[region], overlay);
}
