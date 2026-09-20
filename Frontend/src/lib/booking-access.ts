import { isAdminRole, isHallOwnerRole, normalizeRole } from "@/lib/account-role";
import type { WesalRole } from "@/types/session";

type BookingAccessInput = {
  authenticated: boolean;
  role: WesalRole | null | undefined;
  isOwnHall: boolean;
  hallAvailable: boolean;
};

/**
 * Who may open the booking form.
 * Registered users and hall owners may book other halls; nobody can book their own.
 * Stub login with no role still qualifies as a regular user.
 */
export function canRequestHallBooking({
  authenticated,
  role,
  isOwnHall,
  hallAvailable,
}: BookingAccessInput): boolean {
  if (!authenticated || !hallAvailable || isOwnHall) return false;
  if (isAdminRole(role)) return false;
  if (!role) return true;
  if (isHallOwnerRole(role)) return true;
  return normalizeRole(role) === "registereduser";
}
