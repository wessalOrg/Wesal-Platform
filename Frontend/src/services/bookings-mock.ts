import { BookingError } from "@/lib/booking-errors";
import { finalizedCancelMessageKey } from "@/lib/booking-cancel-errors";
import { ensureAvailabilityDateIso } from "@/lib/booking-date";
import { inferBookingPeriodType } from "@/lib/booking-period";
import { t } from "@/i18n";
import type {
  BookingPeriodType,
  BookingRequestInput,
  BookingRequestResult,
  BookingStatus,
  CancelBookingResult,
  UserBooking,
} from "@/types/booking";
import type { HallAvailabilityDay, HallDayPeriod } from "@/types/hall";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function reservationKey(hallId: string, date: string, period: BookingPeriodType) {
  return `${hallId}|${date}|${period}`;
}

const reserved = new Set<string>();
const mockBookings = new Map<string, UserBooking>();

function seedMockBookings() {
  if (mockBookings.size > 0) return;
  const samples: UserBooking[] = [
    {
      bookingId: "mock-pending-1",
      hallId: "1",
      hallName: t("common.hall"),
      date: "2026-09-20",
      period: "FirstPeriod",
      status: "Pending",
    },
    {
      bookingId: "mock-race-1",
      hallId: "1",
      hallName: t("common.hall"),
      date: "2026-09-21",
      period: "SecondPeriod",
      status: "Pending",
    },
    {
      bookingId: "mock-accepted-1",
      hallId: "2",
      hallName: t("common.hall"),
      date: "2026-09-18",
      period: "FirstPeriod",
      status: "Accepted",
    },
    {
      bookingId: "mock-rejected-1",
      hallId: "2",
      hallName: t("common.hall"),
      date: "2026-09-12",
      period: "SecondPeriod",
      status: "Rejected",
    },
    {
      bookingId: "mock-cancelled-1",
      hallId: "3",
      hallName: t("common.hall"),
      date: "2026-09-10",
      period: "FirstPeriod",
      status: "Cancelled",
    },
  ];
  for (const item of samples) mockBookings.set(item.bookingId, item);
}

function defaultPeriods(): HallDayPeriod[] {
  return [
    {
      periodType: "FirstPeriod",
      label: t("halls.period.first"),
      time: "12:00 – 15:00",
      status: "available",
    },
    {
      periodType: "SecondPeriod",
      label: t("halls.period.second"),
      time: "16:00 – 20:00",
      status: "available",
    },
  ];
}

function overlayReservations(
  hallId: string,
  dateIso: string,
  periods: HallDayPeriod[],
): HallDayPeriod[] {
  return periods.map((period) => {
    const type = period.periodType ?? inferBookingPeriodType(period);
    if (!type) return period;
    if (reserved.has(reservationKey(hallId, dateIso, type))) {
      return { ...period, periodType: type, status: "booked" };
    }
    return { ...period, periodType: type };
  });
}

export function mockFetchPeriodAvailability(
  hallId: string,
  dateIso: string,
  seedDays: HallAvailabilityDay[],
): Promise<HallDayPeriod[]> {
  const days = ensureAvailabilityDateIso(seedDays);
  const day = days.find((item) => item.dateIso === dateIso);
  const periods = overlayReservations(
    hallId,
    dateIso,
    day?.periods?.length ? day.periods : defaultPeriods(),
  );
  return delay(220).then(() => periods);
}

export async function mockSubmitBookingRequest(
  input: BookingRequestInput,
): Promise<BookingRequestResult> {
  await delay(420);

  for (const period of input.periods) {
    if (reserved.has(reservationKey(input.hallId, input.date, period))) {
      throw new BookingError("errors.booking.conflict", 409, { kind: "conflict" });
    }
  }

  for (const period of input.periods) {
    reserved.add(reservationKey(input.hallId, input.date, period));
  }

  const created: BookingRequestResult = {
    hallId: input.hallId,
    hallName: t("common.hall"),
    date: input.date,
    requesterUserId: "demo-user",
    status: "Pending",
    periods: input.periods.map((period, index) => ({
      bookingId: `mock-booking-${input.hallId}-${input.date}-${period}-${index}`,
      period,
      status: "Pending",
    })),
  };

  seedMockBookings();
  for (const item of created.periods) {
    mockBookings.set(item.bookingId, {
      bookingId: item.bookingId,
      hallId: created.hallId,
      hallName: created.hallName,
      date: created.date,
      period: item.period,
      status: "Pending",
    });
  }

  return created;
}

export async function mockFetchMyBookings(): Promise<UserBooking[]> {
  seedMockBookings();
  await delay(180);
  return Array.from(mockBookings.values());
}

export async function mockCancelBookingRequest(
  hallId: string,
  bookingId: string,
): Promise<CancelBookingResult> {
  seedMockBookings();
  await delay(420);

  const booking = mockBookings.get(bookingId);
  if (!booking || booking.hallId !== hallId) {
    throw new BookingError("errors.booking.cancel.notFound", 404, { kind: "not_found" });
  }

  if (bookingId === "mock-race-1") {
    const accepted: UserBooking = { ...booking, status: "Accepted" };
    mockBookings.set(bookingId, accepted);
    throw new BookingError(finalizedCancelMessageKey("Accepted"), 409, { kind: "conflict" });
  }

  if (booking.status !== "Pending") {
    throw new BookingError(finalizedCancelMessageKey(booking.status as BookingStatus), 409, {
      kind: "conflict",
    });
  }

  reserved.delete(reservationKey(booking.hallId, booking.date, booking.period));
  const cancelled: UserBooking = { ...booking, status: "Cancelled" };
  mockBookings.set(bookingId, cancelled);

  return {
    bookingId: cancelled.bookingId,
    hallId: cancelled.hallId,
    hallName: cancelled.hallName,
    date: cancelled.date,
    period: cancelled.period,
    status: "Cancelled",
  };
}
