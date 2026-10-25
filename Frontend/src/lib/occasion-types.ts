/** Shared occasion categories for seeker booking + owner stats. */
export const OCCASION_TYPE_KEYS = [
  "wedding",
  "family",
  "social",
  "official",
  "educational",
  "other",
] as const;

export type OccasionTypeKey = (typeof OCCASION_TYPE_KEYS)[number];

export const OCCASION_TYPE_COLORS: Record<OccasionTypeKey, string> = {
  wedding: "#8b5a7a", // موف غامق
  family: "#c9a227", // أصفر ذهبي
  social: "#2f8eb8", // أزرق سماوي غامق
  official: "#3d6f8c", // أزرق سماوي أعمق
  educational: "#6fa86a", // أخضر فاتح
  other: "#9a6b8c", // موف
};

export function isOccasionTypeKey(value: string | null | undefined): value is OccasionTypeKey {
  return Boolean(value && (OCCASION_TYPE_KEYS as readonly string[]).includes(value));
}

export function occasionTypeI18nKey(key: OccasionTypeKey): `occasion.type.${OccasionTypeKey}` {
  return `occasion.type.${key}`;
}
