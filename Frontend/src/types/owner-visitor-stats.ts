export type OwnerVisitorStats = {
  visitsThisMonth: number;
  visitsPreviousMonth: number;
  favoritesThisMonth: number;
  favoritesPreviousMonth: number;
  bookingRequestsThisMonth: number;
  bookingRequestsPreviousMonth: number;
  conversionRateThisMonth: number;
  conversionRatePreviousMonth: number;
  thisMonthPeriodLabel: string | null;
  previousMonthPeriodLabel: string | null;
  totalActiveBookingsThisMonth: number;
  totalBookedHoursThisMonth: number;
  bookingsByWeekday: OwnerVisitorInsightBreakdown[];
  bookedHoursByPeriod: OwnerVisitorInsightBreakdown[];
  bookingsByOccasionType: OwnerVisitorInsightBreakdown[];
};

export type OwnerVisitorInsightBreakdown = { key: string; count: number; percentage: number };

export type OwnerVisitorStatsLoadStatus = "idle" | "loading" | "ready" | "error";
