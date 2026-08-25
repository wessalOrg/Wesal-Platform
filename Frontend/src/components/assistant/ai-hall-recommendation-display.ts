import type { UiLang } from "@/lib/language";
import type { AiExtractedCriteria } from "@/types/ai-chat";

/** Map API region labels onto existing catalog i18n keys. */
export function regionMessageKey(region: string | null | undefined): string | null {
  if (!region) return null;
  const value = region.toLowerCase().replace(/\s+/g, "");
  if (value.includes("north") || value.includes("شمال")) return "region.north";
  if (value.includes("middle") || value.includes("وسط")) return "region.middle";
  if (value.includes("south") || value.includes("جنوب")) return "region.south";
  if (value.includes("gaza") || value.includes("غزة")) return "region.gaza";
  return null;
}

/** Map bookingPeriod from ExtractedCriteriaDto / BookingPeriodType onto hall period keys. */
export function periodMessageKey(period: string | null | undefined): string | null {
  if (!period) return null;
  const value = period.toLowerCase().replace(/\s+/g, "");
  if (
    value === "0" ||
    value.includes("first") ||
    value.includes("morning") ||
    value.includes("أول") ||
    value.includes("صباح")
  ) {
    return value.includes("morning") || value.includes("صباح")
      ? "halls.period.morning"
      : "halls.period.first";
  }
  if (
    value === "1" ||
    value.includes("second") ||
    value.includes("evening") ||
    value.includes("ثان") ||
    value.includes("مساء")
  ) {
    return value.includes("evening") || value.includes("مساء")
      ? "halls.period.evening"
      : "halls.period.second";
  }
  return null;
}

export function formatRecommendationDate(
  iso: string | null | undefined,
  lang: UiLang,
): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    const dateOnly = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(dateOnly.getTime())) return iso;
    return dateOnly.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return parsed.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRecommendationPrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  return `${price.toLocaleString("en-US")} ₪`;
}

export function criteriaLocation(criteria: AiExtractedCriteria | null): string | null {
  if (!criteria) return null;
  return criteria.region || criteria.area;
}

export function hasRequestedSlot(criteria: AiExtractedCriteria | null): boolean {
  return Boolean(criteria?.date || criteria?.bookingPeriod);
}
