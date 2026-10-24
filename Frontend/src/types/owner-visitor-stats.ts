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
};

export type OwnerVisitorStatsLoadStatus = "idle" | "loading" | "ready" | "error";
