import {
  ADMIN_MANAGEMENT_PATH,
  HALL_OWNER_HALLS_PATH,
  adminHallSubmissionPath,
} from "@/lib/account-profile-path";
import {
  SEEKER_BOOKINGS_PATH,
  seekerBookingContactPath,
} from "@/constants/seekerDashboardNav";
import {
  ownerAdminMessagesPath,
  ownerHallNotificationsPath,
} from "@/lib/hall-owner-query-keys";
import { formatRelativeTime } from "@/lib/relative-time";
import type {
  PlatformNotification,
  PlatformNotificationType,
} from "@/types/platform-notification";

export function resolveNotificationActionUrl(
  type: PlatformNotificationType,
  metadata: PlatformNotification["metadata"] = {},
  actionUrl?: string | null,
): string {
  const explicit = actionUrl?.trim();
  if (explicit) return explicit;

  const hallId = metadata.hall_id?.trim() || "";
  const bookingId = metadata.booking_id?.trim() || "";

  switch (type) {
    case "welcome":
      return "/halls";
    case "booking_submitted":
      return SEEKER_BOOKINGS_PATH;
    case "booking_accepted":
    case "booking_rejected":
      return bookingId ? seekerBookingContactPath(bookingId) : SEEKER_BOOKINGS_PATH;
    case "booking_cancelled":
      return hallId
        ? ownerHallNotificationsPath(hallId, bookingId || null)
        : "/owner/bookings";
    case "hall_submitted":
      return HALL_OWNER_HALLS_PATH;
    case "hall_approved":
      return hallId ? ownerAdminMessagesPath(hallId) : HALL_OWNER_HALLS_PATH;
    case "hall_rejected":
      return ownerAdminMessagesPath(hallId || null);
    case "hall_review_request":
      return hallId ? adminHallSubmissionPath(hallId) : ADMIN_MANAGEMENT_PATH;
    default:
      return "/notifications";
  }
}

export function formatNotificationTime(iso: string): string {
  return formatRelativeTime(iso);
}
