import { BookingError } from "@/lib/booking-errors";
import {
  MAX_PENDING_BOOKING_REQUESTS,
  PENDING_LIMIT_ERROR_CODE,
  PENDING_LIMIT_MESSAGE_KEY,
} from "@/lib/booking-pending-limit";
import { finalizedCancelMessageKey } from "@/lib/booking-cancel-errors";
import type {
  BookingPeriodType,
  BookingRequestInput,
  BookingRequestResult,
  BookingStatus,
  CancelBookingResult,
  UserBooking,
} from "@/types/booking";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function reservationKey(hallId: string, date: string, period: BookingPeriodType) {
  return `${hallId}|${date}|${period}`;
}

const reserved = new Set<string>();
const mockBookings = new Map<string, UserBooking>();

const MOCK_HALL_NAMES: Record<string, string> = {
  "1": "قاعة رويال",
  "2": "قاعة الأندلس",
  "3": "قاعة النخيل الذهبية",
};

function mockHallName(hallId: string): string {
  return MOCK_HALL_NAMES[hallId] ?? "قاعة";
}

function seedMockBookings() {
  if (mockBookings.size > 0) return;
  const samples: UserBooking[] = [
    {
      bookingId: "mock-pending-1",
      hallId: "1",
      hallName: mockHallName("1"),
      date: "2026-09-20",
      period: "FirstPeriod",
      status: "Pending",
    },
    {
      bookingId: "mock-race-1",
      hallId: "1",
      hallName: mockHallName("1"),
      date: "2026-09-21",
      period: "SecondPeriod",
      status: "Pending",
    },
    {
      bookingId: "mock-accepted-1",
      hallId: "2",
      hallName: mockHallName("2"),
      date: "2026-09-18",
      period: "FirstPeriod",
      status: "Accepted",
    },
    {
      bookingId: "mock-rejected-1",
      hallId: "2",
      hallName: mockHallName("2"),
      date: "2026-09-12",
      period: "SecondPeriod",
      status: "Rejected",
      rejectionReason: "القاعة غير متاحة في هذا الوقت لظروف صيانة.",
    },
    {
      bookingId: "mock-cancelled-1",
      hallId: "3",
      hallName: mockHallName("3"),
      date: "2026-09-10",
      period: "FirstPeriod",
      status: "Cancelled",
    },
  ];
  for (const item of samples) mockBookings.set(item.bookingId, item);
}

function countPendingMockBookings(): number {
  seedMockBookings();
  return Array.from(mockBookings.values()).filter((item) => item.status === "Pending").length;
}

export async function mockSubmitBookingRequest(
  input: BookingRequestInput,
): Promise<BookingRequestResult> {
  await delay(420);

  const incoming = new Set(input.periods).size;
  if (countPendingMockBookings() + incoming > MAX_PENDING_BOOKING_REQUESTS) {
    throw new BookingError(PENDING_LIMIT_MESSAGE_KEY, 422, {
      kind: "pending_limit",
      code: PENDING_LIMIT_ERROR_CODE,
    });
  }

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
    hallName: mockHallName(input.hallId),
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

  if (booking.period) {
    reserved.delete(reservationKey(booking.hallId, booking.date, booking.period));
  }
  const cancelled: UserBooking = { ...booking, status: "Cancelled" };
  mockBookings.set(bookingId, cancelled);

  return {
    bookingId: cancelled.bookingId,
    hallId: cancelled.hallId,
    hallName: cancelled.hallName,
    date: cancelled.date,
    period: cancelled.period ?? "FirstPeriod",
    status: "Cancelled",
  };
}
