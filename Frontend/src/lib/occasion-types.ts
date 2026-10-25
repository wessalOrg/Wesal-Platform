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
  wedding: "#c17b7f",
  family: "#e8c9b0",
  social: "#a8d4e8",
  official: "#9aa7b5",
  educational: "#b8a0c8",
  other: "#c4b5a5",
};

export function isOccasionTypeKey(value: string | null | undefined): value is OccasionTypeKey {
  return Boolean(value && (OCCASION_TYPE_KEYS as readonly string[]).includes(value));
}

export function occasionTypeI18nKey(key: OccasionTypeKey): `occasion.type.${OccasionTypeKey}` {
  return `occasion.type.${key}`;
}
