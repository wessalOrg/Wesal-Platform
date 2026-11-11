import {
  ADMIN_MANAGEMENT_PATH,
  HALL_OWNER_HALLS_PATH,
  REGULAR_MESSAGES_PATH,
  REGULAR_PROFILE_PATH,
  adminHallSubmissionPath,
} from "@/lib/account-profile-path";
import {
  SEEKER_BOOKINGS_PATH,
  SEEKER_MESSAGES_PATH,
  SEEKER_OFFERS_PATH,
  seekerAcceptedDepositPath,
  seekerBookingContactPath,
} from "@/constants/seekerDashboardNav";
import {
  ownerAdminMessagesPath,
  ownerBookingsPath,
  ownerHallNotificationsPath,
} from "@/lib/hall-owner-query-keys";
import { formatRelativeTime } from "@/lib/relative-time";
import type {
  NotificationAudience,
  PlatformNotification,
  PlatformNotificationType,
} from "@/types/platform-notification";

export function resolveNotificationActionUrl(
  type: PlatformNotificationType,
  metadata: PlatformNotification["metadata"] = {},
  actionUrl?: string | null,
  audience?: NotificationAudience,
): string {
  const explicit = actionUrl?.trim();
  const hallId = metadata.hall_id?.trim() || "";
  const bookingId = metadata.booking_id?.trim() || "";
  const conversationId = metadata.conversation_id?.trim() || "";
  const postId = metadata.post_id?.trim() || "";
  const offerId = metadata.offer_id?.trim() || "";
  const staleOwnerBookingHref =
    type === "booking_submitted" &&
    audience === "owner" &&
    typeof explicit === "string" &&
    (explicit === SEEKER_BOOKINGS_PATH ||
      explicit.startsWith(`${SEEKER_BOOKINGS_PATH}?`));
  const staleAcceptedMessagesHref =
    type === "booking_accepted" &&
    audience !== "owner" &&
    typeof explicit === "string" &&
    explicit.startsWith("/messages");
  if (explicit && !staleOwnerBookingHref && !staleAcceptedMessagesHref) return explicit;

  switch (type) {
    case "welcome":
      return "/halls";
    case "booking_submitted":
      if (audience === "owner") {
        return hallId
          ? ownerHallNotificationsPath(hallId, bookingId || null)
          : ownerBookingsPath(bookingId || null);
      }
      return SEEKER_BOOKINGS_PATH;
    case "booking_accepted":
      if (conversationId) return seekerAcceptedDepositPath(bookingId, conversationId);
      return bookingId ? seekerBookingContactPath(bookingId) : SEEKER_BOOKINGS_PATH;
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
    case "registration_rejected":
    case "registration_needs_changes":
      return conversationId
        ? `${REGULAR_MESSAGES_PATH}?conversation_id=${encodeURIComponent(conversationId)}`
        : REGULAR_MESSAGES_PATH;
    case "new_message":
    case "account_needs_edit":
    case "account_rejected":
      return conversationId
        ? `${REGULAR_MESSAGES_PATH}?conversation_id=${encodeURIComponent(conversationId)}`
        : audience === "owner"
          ? "/owner/messages"
          : SEEKER_MESSAGES_PATH;
    case "offer_published":
    case "offer_edits_saved":
    case "offer_ending_soon":
    case "offer_ended":
    case "offer_stopped":
      return offerId
        ? `/discover?offer=${encodeURIComponent(offerId)}`
        : SEEKER_OFFERS_PATH;
    case "post_edits_saved":
    case "post_comment":
    case "post_comment_reply":
      return postId ? `/posts/${encodeURIComponent(postId)}` : REGULAR_PROFILE_PATH;
    case "account_approved":
    case "account_received":
    case "account_pending":
    case "account_unlocked":
      return REGULAR_PROFILE_PATH;
    case "offer_deleted":
    case "post_deleted":
    case "publishing_restricted":
    case "account_locked":
    case "subscription":
      return `${REGULAR_PROFILE_PATH}/notifications`;
    default:
      return "/notifications";
  }
}

export function formatNotificationTime(iso: string): string {
  return formatRelativeTime(iso);
}
