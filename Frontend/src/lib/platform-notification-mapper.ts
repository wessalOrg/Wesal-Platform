import {
  HALL_OWNER_HALLS_PATH,
  REGULAR_PROFILE_PATH,
  professionalAdminMessagesPath,
} from "@/lib/account-profile-path";
import { SEEKER_BOOKINGS_PATH, conversationMessagePath } from "@/constants/seekerDashboardNav";
import { ownerBookingsPath } from "@/lib/hall-owner-query-keys";
import { eventRequestConversationId, isEventRequestNotification } from "@/lib/event-request-notification";
import type {
  NotificationAudience,
  PlatformNotification,
  PlatformNotificationMetadata,
  PlatformNotificationTone,
  PlatformNotificationType,
} from "@/types/platform-notification";

/** Deep-link professionals into the Admin tab + AdminAccount thread. */
function professionalAdminConversationUrl(conversationId: string | null): string {
  return professionalAdminMessagesPath(conversationId);
}

export type ServerNotificationKindMapping = {
  type: PlatformNotificationType;
  audience: NotificationAudience;
  tone: PlatformNotificationTone;
  /** Where `targetId` points, so it lands in the right metadata field. */
  target?: "hall" | "conversation" | "booking" | "post" | "offer";
  actionUrl?: (targetId: string | null) => string | undefined;
};

function postPath(id: string | null): string | undefined {
  return id ? `/posts/${encodeURIComponent(id)}` : undefined;
}

function offerPath(id: string | null): string | undefined {
  return id ? `/discover?offer=${encodeURIComponent(id)}` : `${REGULAR_PROFILE_PATH}/offers`;
}

function messagesPath(id: string | null): string {
  return id ? conversationMessagePath(id) : `${REGULAR_PROFILE_PATH}/messages`;
}

/**
 * Backend notification kinds the frontend surfaces. The key is the C# `NotificationKind`
 * enum name from `Wesal.Domain.Notifications.NotificationKind`.
 *
 * Engagement counters (save/share/view) are intentionally absent — those belong on the
 * statistics dashboard only (Section 14 / 16).
 */
export const SERVER_NOTIFICATION_KIND_MAP: Record<string, ServerNotificationKindMapping> = {
  EVENT_REQUEST_HALL: { type: "event_request_hall", audience: "owner", tone: "info", target: "conversation" },
  EVENT_REQUEST_DECORATION_GIFTS: { type: "event_request_decoration_gifts", audience: "seeker", tone: "info", target: "conversation" },
  EVENT_REQUEST_PHOTOGRAPHY: { type: "event_request_photography", audience: "seeker", tone: "info", target: "conversation" },
  WelcomeLogin: { type: "welcome", audience: "seeker", tone: "info" },

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
  BookingRequestSentToRequester: {
    type: "booking_submitted",
    audience: "seeker",
    tone: "info",
    actionUrl: () => SEEKER_BOOKINGS_PATH,
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
  BookingCancelledForOwner: {
    type: "booking_cancelled",
    audience: "owner",
    tone: "info",
    target: "booking",
    actionUrl: (id) => ownerBookingsPath(id),
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

  // —— Professional account / approval (coordinator + photographer) ——
  CoordinatorSetupReceivedForCoordinator: {
    type: "account_received",
    audience: "seeker",
    tone: "info",
  },
  PhotographerSetupReceivedForPhotographer: {
    type: "account_received",
    audience: "seeker",
    tone: "info",
  },
  CoordinatorPendingReview: { type: "account_pending", audience: "seeker", tone: "info" },
  PhotographerPendingReview: { type: "account_pending", audience: "seeker", tone: "info" },
  CoordinatorApprovedForCoordinator: {
    type: "account_approved",
    audience: "seeker",
    tone: "success",
  },
  PhotographerApprovedForPhotographer: {
    type: "account_approved",
    audience: "seeker",
    tone: "success",
  },
  // Task 5 — registration rejection / photographer request-changes (body carries reason/notes).
  // Prefer stashed account_* surface types; deep-link via teammate admin conversation URL.
  PhotographerNeedsChangesForPhotographer: {
    type: "account_needs_edit",
    audience: "seeker",
    tone: "warning",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  CoordinatorNeedsChangesForCoordinator: {
    type: "account_needs_edit",
    audience: "seeker",
    tone: "warning",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  CoordinatorRejectedForCoordinator: {
    type: "account_rejected",
    audience: "seeker",
    tone: "danger",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  PhotographerRejectedForPhotographer: {
    type: "account_rejected",
    audience: "seeker",
    tone: "danger",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },

  // —— Offers / posts ——
  ProfessionalOfferPublishedForCoordinator: {
    type: "offer_published",
    audience: "seeker",
    tone: "success",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferPublishedForPhotographer: {
    type: "offer_published",
    audience: "seeker",
    tone: "success",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferEditsSaved: {
    type: "offer_edits_saved",
    audience: "seeker",
    tone: "warning",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferReminder24Hours: {
    type: "offer_ending_soon",
    audience: "seeker",
    tone: "warning",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferEndedForCoordinator: {
    type: "offer_ended",
    audience: "seeker",
    tone: "info",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferEndedForPhotographer: {
    type: "offer_ended",
    audience: "seeker",
    tone: "info",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferStopped: {
    type: "offer_stopped",
    audience: "seeker",
    tone: "info",
    target: "offer",
    actionUrl: offerPath,
  },
  ProfessionalOfferDeletedByAdmin: {
    type: "offer_deleted",
    audience: "seeker",
    tone: "danger",
  },
  PostEditsSaved: {
    type: "post_edits_saved",
    audience: "seeker",
    tone: "warning",
    target: "post",
    actionUrl: postPath,
  },

  // —— Comments ——
  PostCommentedForCoordinator: {
    type: "post_comment",
    audience: "seeker",
    tone: "info",
    target: "post",
    actionUrl: postPath,
  },
  PostCommentedForPhotographer: {
    type: "post_comment",
    audience: "seeker",
    tone: "info",
    target: "post",
    actionUrl: postPath,
  },
  PostCommentReplyForOwner: {
    type: "post_comment_reply",
    audience: "seeker",
    tone: "info",
    target: "post",
    actionUrl: postPath,
  },
  PostCommentReplyOnOwnerPost: {
    type: "post_comment_reply",
    audience: "seeker",
    tone: "info",
    target: "post",
    actionUrl: postPath,
  },

  // —— Messages ——
  NewMessage: {
    type: "new_message",
    audience: "seeker",
    tone: "info",
    target: "conversation",
    actionUrl: (id) => messagesPath(id),
  },
  AdminMessageForCoordinator: {
    type: "new_message",
    audience: "seeker",
    tone: "info",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  AdminMessageForPhotographer: {
    type: "new_message",
    audience: "seeker",
    tone: "info",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  // Legacy aliases kept for older hub payloads.
  NewAdminMessage: {
    type: "new_message",
    audience: "seeker",
    tone: "info",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },
  AdminMessageForProfessional: {
    type: "new_message",
    audience: "seeker",
    tone: "info",
    target: "conversation",
    actionUrl: professionalAdminConversationUrl,
  },

  // —— Admin moderation (14.3) ——
  PostDeletedByAdminForCoordinator: {
    type: "post_deleted",
    audience: "seeker",
    tone: "danger",
  },
  PostDeletedByAdminForPhotographer: {
    type: "post_deleted",
    audience: "seeker",
    tone: "danger",
  },
  PublishingRestricted: {
    type: "publishing_restricted",
    audience: "seeker",
    tone: "danger",
  },
  AccountLocked: { type: "account_locked", audience: "seeker", tone: "danger" },
  AccountUnlocked: { type: "account_unlocked", audience: "seeker", tone: "success" },
};

/** The `NotificationActionTarget` enum names the backend may send on a durable inbox row. */
const ACTION_TARGET_METADATA: Record<
  string,
  "hall" | "conversation" | "booking" | "post" | "offer"
> = {
  BookingRequestDetails: "booking",
  MyBookings: "booking",
  OwnerBookingRequests: "booking",
  MyHalls: "hall",
  AdminHallRequests: "hall",
  Conversation: "conversation",
  Post: "post",
  Offer: "offer",
};

export type ServerNotificationInput = {
  /** Structured event-request fields are included only in the durable REST DTO. */
  payloadJson?: unknown;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  actionLabel?: string | null;
  targetId?: string | null;
  /** `NotificationActionTarget` enum name; used only when the kind map has no target. */
  actionTarget?: string | null;
  conversationId?: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  messagePreview?: string | null;
  messageCount?: number | null;
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
  if (!input || typeof input !== "object") return null;
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const kind = text(input.kind);
  const mapping = kind && Object.hasOwn(SERVER_NOTIFICATION_KIND_MAP, kind) ? SERVER_NOTIFICATION_KIND_MAP[kind] : undefined;
  const title = text(input.title);
  const body = text(input.body);
  if (!mapping || (!title && !body)) return null;

  const eventRequest = isEventRequestNotification(mapping.type);
  const conversationId = eventRequest
    ? eventRequestConversationId(input.conversationId) ??
      (!input.actionTarget || input.actionTarget === "Conversation" ? eventRequestConversationId(input.targetId) : null)
    : text(input.conversationId) || null;
  const targetId = eventRequest ? conversationId : text(input.targetId) || conversationId || null;
  const target =
    mapping.target ??
    (input.actionTarget ? ACTION_TARGET_METADATA[input.actionTarget] : undefined);
  const metadata: PlatformNotificationMetadata = { server_kind: kind || undefined };
  if (eventRequest && typeof input.payloadJson === "string") {
    try {
      const payload: unknown = JSON.parse(input.payloadJson);
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const fields = payload as Record<string, unknown>;
        metadata.event_request_id = text(fields.eventRequestId) || undefined;
        metadata.seeker_id = text(fields.seekerId) || undefined;
        metadata.user_name = text(fields.fullName) || undefined;
        metadata.date = text(fields.eventDate) || undefined;
        metadata.event_type = text(fields.eventType) || undefined;
        metadata.service_type = text(fields.serviceType) || undefined;
      }
    } catch { /* Optional structured fields never replace the localized backend content or routing. */ }
  }
  if (targetId && target === "hall") metadata.hall_id = targetId;
  if (targetId && target === "conversation") metadata.conversation_id = targetId;
  if (targetId && target === "booking") metadata.booking_id = targetId;
  if (targetId && target === "post") metadata.post_id = targetId;
  if (targetId && target === "offer") metadata.offer_id = targetId;
  if (conversationId) metadata.conversation_id = conversationId;
  if (text(input.senderName)) metadata.sender_name = text(input.senderName);
  if (text(input.senderAvatarUrl)) metadata.sender_avatar_url = text(input.senderAvatarUrl);
  if (text(input.messagePreview)) metadata.message_preview = text(input.messagePreview);
  if (typeof input.messageCount === "number" && input.messageCount > 0) {
    metadata.message_count = String(Math.floor(input.messageCount));
  }

  const richTitle =
    mapping.type === "new_message" ? metadata.sender_name || title : eventRequest ? title || body : title;
  const richBody =
    mapping.type === "new_message" ? metadata.message_preview || body : body;

  const actionTargetId =
    metadata.conversation_id ??
    metadata.post_id ??
    metadata.offer_id ??
    metadata.booking_id ??
    metadata.hall_id ??
    targetId;

  return {
    type: mapping.type,
    audience: mapping.audience,
    tone: mapping.tone,
    title: richTitle,
    body: richBody,
    actionLabel: text(input.actionLabel) || undefined,
    action_url: mapping.actionUrl?.(actionTargetId) ?? "",
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
    metadata.post_id ?? "",
    metadata.offer_id ?? "",
    metadata.server_kind ?? "",
  ].join("|");
}
