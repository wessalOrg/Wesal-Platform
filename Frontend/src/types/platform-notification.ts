export type NotificationAudience = "seeker" | "owner" | "admin";

/**
 * Frontend surface types. Server `NotificationKind` names map into these in
 * `platform-notification-mapper.ts`.
 */
export type PlatformNotificationType =
  | "welcome"
  | "booking_submitted"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_cancelled"
  | "hall_submitted"
  | "hall_approved"
  | "hall_rejected"
  | "hall_review_request"
  | "subscription"
  /** Coordinator/Photographer registration rejected — opens Admin conversation. */
  | "registration_rejected"
  /** Photographer NeedsChanges — opens Admin conversation. */
  | "registration_needs_changes"
  | "new_message"
  | "account_received"
  | "account_pending"
  | "account_approved"
  | "account_needs_edit"
  | "account_rejected"
  | "offer_published"
  | "offer_edits_saved"
  | "offer_ending_soon"
  | "offer_ended"
  | "offer_stopped"
  | "offer_deleted"
  | "post_edits_saved"
  | "post_comment"
  | "post_comment_reply"
  | "post_deleted"
  | "publishing_restricted"
  | "account_locked"
  | "account_unlocked";

export type PlatformNotificationTone = "success" | "danger" | "info" | "warning";

/** Dropdown / page filter chips from the Figma notifications panel. */
export type NotificationFilter = "all" | "offers" | "requests" | "system";

/** Standardized metadata keys from the notification payload contract. */
export type PlatformNotificationMetadata = {
  hall_id?: string;
  booking_id?: string;
  conversation_id?: string;
  post_id?: string;
  offer_id?: string;
  deposit_amount?: string;
  rejection_reason?: string;
  hall_name?: string;
  user_name?: string;
  date?: string;
  period?: string;
  sender_name?: string;
  sender_avatar_url?: string;
  message_preview?: string;
  message_count?: string;
  /** Original C# `NotificationKind` name when known. */
  server_kind?: string;
};

export type PlatformNotification = {
  id: string;
  type: PlatformNotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  /** Alias of `body` for the shared payload shape. */
  message: string;
  action_url: string;
  action_label?: string;
  metadata: PlatformNotificationMetadata;
  is_read: boolean;
  created_at: string;
  tone: PlatformNotificationTone;
  titleKey: string;
  bodyKey: string;
  actionLabelKey?: string;
  params: Record<string, string>;
};

export function notificationFilterForType(
  type: PlatformNotificationType,
): Exclude<NotificationFilter, "all"> {
  switch (type) {
    case "offer_published":
    case "offer_edits_saved":
    case "offer_ending_soon":
    case "offer_ended":
    case "offer_stopped":
    case "offer_deleted":
    case "post_edits_saved":
      return "offers";
    case "account_received":
    case "account_pending":
    case "account_approved":
    case "account_needs_edit":
    case "account_rejected":
    case "registration_rejected":
    case "registration_needs_changes":
      return "requests";
    default:
      return "system";
  }
}

export function matchesNotificationFilter(
  item: Pick<PlatformNotification, "type">,
  filter: NotificationFilter,
): boolean {
  if (filter === "all") return true;
  return notificationFilterForType(item.type) === filter;
}
