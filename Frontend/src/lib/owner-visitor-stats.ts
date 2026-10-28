import type { OwnerVisitorInsightBreakdown, OwnerVisitorStats } from "@/types/owner-visitor-stats";

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asBreakdown(value: unknown): OwnerVisitorInsightBreakdown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const key = row.key ?? row.Key;
    if (typeof key !== "string") return [];
    return [{ key, count: asNumber(row.count ?? row.Count), percentage: asNumber(row.percentage ?? row.Percentage) }];
  });
}

/** Map API camelCase / PascalCase payload to the UI model. */
export function mapOwnerVisitorStats(raw: unknown): OwnerVisitorStats {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    visitsThisMonth: asNumber(row.visitsThisMonth ?? row.VisitsThisMonth),
    visitsPreviousMonth: asNumber(row.visitsPreviousMonth ?? row.VisitsPreviousMonth),
    favoritesThisMonth: asNumber(row.favoritesThisMonth ?? row.FavoritesThisMonth),
    favoritesPreviousMonth: asNumber(row.favoritesPreviousMonth ?? row.FavoritesPreviousMonth),
    bookingRequestsThisMonth: asNumber(
      row.bookingRequestsThisMonth ?? row.BookingRequestsThisMonth,
    ),
    bookingRequestsPreviousMonth: asNumber(
      row.bookingRequestsPreviousMonth ?? row.BookingRequestsPreviousMonth,
    ),
    conversionRateThisMonth: asNumber(
      row.conversionRateThisMonth ?? row.ConversionRateThisMonth,
    ),
    conversionRatePreviousMonth: asNumber(
      row.conversionRatePreviousMonth ?? row.ConversionRatePreviousMonth,
    ),
    thisMonthPeriodLabel: asOptionalString(
      row.thisMonthPeriodLabel ?? row.ThisMonthPeriodLabel,
    ),
    previousMonthPeriodLabel: asOptionalString(
      row.previousMonthPeriodLabel ?? row.PreviousMonthPeriodLabel,
    ),
    totalActiveBookingsThisMonth: asNumber(row.totalActiveBookingsThisMonth ?? row.TotalActiveBookingsThisMonth),
    totalBookedHoursThisMonth: asNumber(row.totalBookedHoursThisMonth ?? row.TotalBookedHoursThisMonth),
    bookingsByWeekday: asBreakdown(row.bookingsByWeekday ?? row.BookingsByWeekday),
    bookedHoursByPeriod: asBreakdown(row.bookedHoursByPeriod ?? row.BookedHoursByPeriod),
    bookingsByOccasionType: asBreakdown(row.bookingsByOccasionType ?? row.BookingsByOccasionType),
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function formatStatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : "en-GB").format(
    Math.max(0, Math.round(value)),
  );
}

export function formatConversionRate(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : "en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(Math.max(0, value))}%`;
}

/** Relative bar fill so the largest metric reads full without capping tiny values to zero. */
export function relativeBarPercent(value: number, peak: number): number {
  if (peak <= 0) return 0;
  return Math.min(100, Math.max(8, Math.round((value / peak) * 100)));
}
