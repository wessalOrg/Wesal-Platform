import { emitBookingAccepted } from "@/lib/booking-events";
import { parseDepositAmount } from "@/lib/booking-deposits";
import {
  loadRememberedBookings,
  rememberUserBookings,
} from "@/lib/user-bookings-store";

/** Matches BookingAcceptanceService.BuildApprovalContent on the backend. */
const APPROVAL_TEXT =
  /تم قبول طلب الحجز الخاص بك\.?\s*برجاء دفع عربون قدره\s*([\d.]+)\s*للتأكيد النهائي للحجز/;

export function parseBookingApprovalDeposit(content: string): number | null {
  const match = (content ?? "").trim().match(APPROVAL_TEXT);
  if (!match) return null;
  return parseDepositAmount(match[1]);
}

/** Maps the owner approval chat notice onto the seeker's remembered bookings. */
export function applyBookingAcceptanceFromMessage(
  content: string,
  fallbackHallName = "",
): void {
  const depositAmount = parseBookingApprovalDeposit(content);
  if (depositAmount == null) return;

  const current = loadRememberedBookings();
  const hallName = fallbackHallName.trim();
  const match = current.find((item) => {
    if (item.status !== "Pending") return false;
    if (hallName && item.hallName.trim() && item.hallName.trim() !== hallName) return false;
    return true;
  });
  if (!match) return;

  const patched = { ...match, status: "Accepted" as const, depositAmount };
  rememberUserBookings([patched]);
  emitBookingAccepted({
    bookingId: patched.bookingId,
    hallId: patched.hallId,
    date: patched.date,
    periods: patched.period ? [patched.period] : [],
    hallName: patched.hallName || hallName,
    depositAmount,
  });
}
