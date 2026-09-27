export type NotificationAudience = "seeker" | "owner" | "admin";

export type PlatformNotificationType =
  | "welcome"
  | "booking_submitted"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_cancelled"
  | "hall_submitted"
  | "hall_approved"
  | "hall_rejected"
  | "hall_review_request";

export type PlatformNotificationTone = "success" | "danger" | "info";

/** Standardized metadata keys from the Edit 13 payload contract. */
export type PlatformNotificationMetadata = {
  hall_id?: string;
  booking_id?: string;
  conversation_id?: string;
  deposit_amount?: string;
  rejection_reason?: string;
  hall_name?: string;
  user_name?: string;
  date?: string;
  period?: string;
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
