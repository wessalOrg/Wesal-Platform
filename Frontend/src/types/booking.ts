export type BookingPeriodType = "FirstPeriod" | "SecondPeriod";

export type BookingStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled";

export type BookingRequestInput = {
  hallId: string;
  date: string;
  periods: BookingPeriodType[];
};

export type CreatedBooking = {
  bookingId: string;
  period: BookingPeriodType;
  status: string;
};

export type BookingRequestResult = {
  hallId: string;
  hallName: string;
  date: string;
  requesterUserId: string;
  status: string;
  periods: CreatedBooking[];
};

export type UserBooking = {
  bookingId: string;
  hallId: string;
  hallName: string;
  date: string;
  period: BookingPeriodType;
  status: BookingStatus;
};

export type CancelBookingResult = {
  bookingId: string;
  hallId: string;
  hallName: string;
  date: string;
  period: BookingPeriodType;
  status: BookingStatus;
};

export type BookingErrorKind =
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "validation"
  | "not_found"
  | "generic";

export type BookingFieldErrors = {
  date?: string;
  periods?: string;
};
