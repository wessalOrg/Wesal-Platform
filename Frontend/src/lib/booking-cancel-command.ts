import { BookingError } from "@/lib/booking-errors";
import { finalizedCancelMessageKey } from "@/lib/booking-cancel-errors";
import { canCancelBooking } from "@/lib/booking-status";
import { cancelBookingRequest } from "@/services/bookings";
import type { BookingStatus, CancelBookingResult } from "@/types/booking";

export type CancelBookingCommand = {
  hallId: string;
  bookingId: string;
  status: BookingStatus;
};

export async function executeCancelBooking(
  command: CancelBookingCommand,
): Promise<CancelBookingResult> {
  if (!canCancelBooking(command.status)) {
    throw new BookingError(finalizedCancelMessageKey(command.status), 409, { kind: "conflict" });
  }

  return cancelBookingRequest(command.hallId, command.bookingId);
}
