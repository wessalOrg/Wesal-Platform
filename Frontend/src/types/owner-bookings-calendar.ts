/** One day from GET /owner/halls/{hallId}/bookings-calendar. */
export type OwnerBookingsCalendarDay = {
  date: string;
  /** Authoritative Edit 23 flag from the backend. True exactly when booked hours exist. */
  hasBookedHours: boolean;
  /** Whole-hour starts (HH:mm), ordered and de-duplicated by the backend. */
  bookedHours: string[];
};

export type OwnerBookingsCalendar = {
  hallId: string;
  fromDate: string;
  toDate: string;
  days: OwnerBookingsCalendarDay[];
};

export type OwnerBookingsCalendarStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; calendar: OwnerBookingsCalendar }
  | { status: "error" };
