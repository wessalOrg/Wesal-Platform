import { HALL_OWNER_HALLS_PATH } from "@/lib/account-profile-path";
import { SEEKER_BOOKINGS_PATH, conversationMessagePath } from "@/constants/seekerDashboardNav";
import { ownerBookingsPath } from "@/lib/hall-owner-query-keys";
import type {
  NotificationAudience,
  PlatformNotification,
  PlatformNotificationMetadata,
  PlatformNotificationTone,
  PlatformNotificationType,
} from "@/types/platform-notification";

export type ServerNotificationKindMapping = {
  type: PlatformNotificationType;
  audience: NotificationAudience;
  tone: PlatformNotificationTone;
  /** Where `targetId` points, so it lands in the right metadata field. */
  target?: "hall" | "conversation" | "booking";
  actionUrl?: (targetId: string | null) => string | undefined;
};

/**
 * Backend notification kinds the frontend surfaces. The key is the C# `NotificationKind`
 * enum name, which arrives both on the SignalR hub event and on the REST inbox DTO's `type`
 * field, so a single map serves the realtime feed and the durable inbox.
 *
 * Kinds the client already derives from its own realtime feeds (cancellations, requester
 * "sent", welcome) are intentionally absent. Owner booking requests are mapped here because
 * they are now persisted in the server inbox and must survive offline delivery.
 */
export const SERVER_NOTIFICATION_KIND_MAP: Record<string, ServerNotificationKindMapping> = {
  HallCreatedForOwner: { type: "hall_submitted", audience: "owner", tone: "success", target: "hall" },
  HallApprovedForOwner: { type: "hall_approved", audience: "owner", tone: "success", target: "hall" },
  HallRejectedForOwner: {
    type: "hall_rejected",
    audience: "owner",
    tone: "danger",
    target: "conversation",
  },
  HallSubmittedForAdmin: {
    type: "hall_review_request",
    audience: "admin",
    tone: "info",
    target: "hall",
  },
  BookingAcceptedForRequester: {
    type: "booking_accepted",
    audience: "seeker",
    tone: "success",
    target: "conversation",
  },
  BookingRequestCreatedForOwner: {
    type: "booking_submitted",
    audience: "owner",
    tone: "info",
    target: "booking",
    actionUrl: (id) => ownerBookingsPath(id),
  },
  BookingRejectedForRequester: {
    type: "booking_rejected",
    audience: "seeker",
    tone: "danger",
    target: "conversation",
    actionUrl: (id) => (id ? conversationMessagePath(id) : SEEKER_BOOKINGS_PATH),
  },
  BookingCancelledForRequester: {
    type: "booking_cancelled",
    audience: "seeker",
    tone: "info",
    actionUrl: () => SEEKER_BOOKINGS_PATH,
  },
  SubscriptionPaidForOwner: {
    type: "subscription",
    audience: "owner",
    tone: "success",
    actionUrl: () => HALL_OWNER_HALLS_PATH,
  },
  SubscriptionExpiringForOwner: {
    type: "subscription",
    audience: "owner",
    tone: "info",
    actionUrl: () => HALL_OWNER_HALLS_PATH,
  },
  SubscriptionExpiredForOwner: {
    type: "subscription",
    audience: "owner",
    tone: "danger",
    actionUrl: () => HALL_OWNER_HALLS_PATH,
  },
};

/** The `NotificationActionTarget` enum names the backend may send on a durable inbox row. */
const ACTION_TARGET_METADATA: Record<string, "hall" | "conversation" | "booking"> = {
  BookingRequestDetails: "booking",
  MyBookings: "booking",
  OwnerBookingRequests: "booking",
  MyHalls: "hall",
  AdminHallRequests: "hall",
  Conversation: "conversation",
};

export type ServerNotificationInput = {
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  actionLabel?: string | null;
  targetId?: string | null;
  /** `NotificationActionTarget` enum name; used only when the kind map has no target. */
  actionTarget?: string | null;
};

export type MappedServerNotification = {
  type: PlatformNotificationType;
  audience: NotificationAudience;
  tone: PlatformNotificationTone;
  title: string;
  body: string;
  actionLabel?: string;
  action_url: string;
  metadata: PlatformNotificationMetadata;
};

/** Returns null for kinds the frontend deliberately does not surface, or empty content. */
export function mapServerNotification(
  input: ServerNotificationInput,
): MappedServerNotification | null {
  const mapping = input.kind ? SERVER_NOTIFICATION_KIND_MAP[input.kind] : undefined;
  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!mapping || (!title && !body)) return null;

  const targetId = input.targetId?.trim() || null;
  const target = mapping.target ?? (input.actionTarget ? ACTION_TARGET_METADATA[input.actionTarget] : undefined);
  const metadata: PlatformNotificationMetadata = {};
  if (targetId && target === "hall") metadata.hall_id = targetId;
  if (targetId && target === "conversation") metadata.conversation_id = targetId;
  if (targetId && target === "booking") metadata.booking_id = targetId;

  return {
    type: mapping.type,
    audience: mapping.audience,
    tone: mapping.tone,
    title,
    body,
    actionLabel: input.actionLabel?.trim() || undefined,
    action_url: mapping.actionUrl?.(targetId) ?? "",
    metadata,
  };
}

/**
 * Stable identity for de-duplication across the realtime push and the durable REST inbox:
 * two entries describing the same event share the same type, audience and target ids.
 */
export function platformNotificationDedupeKey(item: {
  type: PlatformNotification["type"];
  audience: PlatformNotification["audience"];
  metadata: PlatformNotificationMetadata;
}): string {
  const metadata = item.metadata ?? {};
  return [
    item.type,
    item.audience,
    metadata.hall_id ?? "",
    metadata.booking_id ?? "",
    metadata.conversation_id ?? "",
  ].join("|");
}
