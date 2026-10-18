import { emitBookingAccepted } from "@/lib/booking-events";
import { parseDepositAmount } from "@/lib/booking-deposits";
import {
  loadRememberedBookings,
  rememberUserBookings,
} from "@/lib/user-bookings-store";

/** Matches current and older owner-approval chat notices (catalog + legacy). */
const APPROVAL_DEPOSIT =
  /(?:عربون(?:\s+قدره)?|deposit(?: payment notice)?(?: of)?)\s*(?:والذي هو\s*)?["“”]?\s*([\d]+(?:[.,]\d+)?)\s*["“”]?\s*(?:شيكل|ILS)?/i;

export function parseBookingApprovalDeposit(content: string): number | null {
  const match = APPROVAL_DEPOSIT.exec((content ?? "").trim());
  if (!match) return null;
  return parseDepositAmount(match[1].replace(",", "."));
}

/**
 * Maps the owner approval chat notice onto the seeker's remembered bookings.
 *
 * `conversationId` is the thread the notice was read from. The backend resolves exactly the
 * seeker <-> hall owner conversation when it accepts a booking, so passing it through lets the
 * resulting notification open that thread instead of the generic bookings page.
 */
export function applyBookingAcceptanceFromMessage(
  content: string,
  fallbackHallName = "",
  conversationId?: string | null,
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
    conversationId: conversationId?.trim() || undefined,
  });
}
