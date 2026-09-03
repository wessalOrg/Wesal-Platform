import { isHallOwnerRole, normalizeRole } from "@/lib/account-role";
import type { WesalRole } from "@/types/session";

type BookingAccessInput = {
  authenticated: boolean;
  role: WesalRole | null | undefined;
  isOwnHall: boolean;
  hallAvailable: boolean;
};

/**
 * Who may open the booking form. Stub login has no session role and still
 * qualifies as a regular user. Live Hall Owners cannot book any hall.
 */
export function canRequestHallBooking({
  authenticated,
  role,
  isOwnHall,
  hallAvailable,
}: BookingAccessInput): boolean {
  if (!authenticated || !hallAvailable || isOwnHall) return false;
  if (isHallOwnerRole(role)) return false;
  if (!role) return true;
  return normalizeRole(role) === "registereduser";
}
