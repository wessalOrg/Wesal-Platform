import { HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { apiOrigin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { realtimeLogger } from "@/lib/realtime-logger";
import { HALL_OWNER_HALLS_PATH } from "@/lib/account-profile-path";
import { SEEKER_BOOKINGS_PATH, conversationMessagePath } from "@/constants/seekerDashboardNav";
import { pushPlatformNotification } from "@/lib/platform-notifications-store";
import type {
  NotificationAudience,
  PlatformNotificationMetadata,
  PlatformNotificationTone,
  PlatformNotificationType,
} from "@/types/platform-notification";

/** Shape of the backend `NotificationEvent` (already localized for the recipient). */
export type ServerNotificationEvent = {
  kind?: string;
  language?: string;
  title?: string;
  body?: string;
  actionLabel?: string | null;
  actionTarget?: string | null;
  targetId?: string | null;
  occurredAt?: string;
};

type Mapping = {
  type: PlatformNotificationType;
  audience: NotificationAudience;
  tone: PlatformNotificationTone;
  /** Where `targetId` points, so it lands in the right metadata field. */
  target?: "hall" | "conversation" | "booking";
  actionUrl?: (targetId: string | null) => string | undefined;
};

/**
 * Backend notification kinds the frontend surfaces. Kinds that the client already derives from
 * its own realtime feeds (owner booking requests / cancellations, requester "sent", welcome) are
 * intentionally absent so the list never shows the same event twice.
 */
const KIND_MAP: Record<string, Mapping> = {
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

/** Converts one server notification into the local feed. Unknown kinds are ignored. */
export function applyServerNotification(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const event = raw as ServerNotificationEvent;
  const mapping = event.kind ? KIND_MAP[event.kind] : undefined;
  const title = event.title?.trim() ?? "";
  const body = event.body?.trim() ?? "";
  if (!mapping || (!title && !body)) return;

  const targetId = event.targetId?.trim() || null;
  const metadata: PlatformNotificationMetadata = {};
  if (targetId && mapping.target === "hall") metadata.hall_id = targetId;
  if (targetId && mapping.target === "conversation") metadata.conversation_id = targetId;
  if (targetId && mapping.target === "booking") metadata.booking_id = targetId;

  pushPlatformNotification({
    type: mapping.type,
    audience: mapping.audience,
    title,
    body,
    actionLabel: event.actionLabel?.trim() || undefined,
    action_url: mapping.actionUrl?.(targetId),
    metadata,
    tone: mapping.tone,
  });
}

const HUB_EVENT = "NotificationReceived";

let connection: HubConnection | null = null;
let connectedToken: string | null = null;
let startPromise: Promise<void> | null = null;
let subscribers = 0;

function hubUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_NOTIFICATIONS_HUB_URL?.trim();
  return explicit || `${apiOrigin()}/hubs/notifications`;
}

async function joinGroup(hub: HubConnection) {
  await hub.invoke("JoinNotificationsGroup").catch(() => undefined);
}

async function stopHub() {
  const hub = connection;
  connection = null;
  connectedToken = null;
  startPromise = null;
  if (!hub) return;
  try {
    await hub.stop();
  } catch {
    /* ignore */
  }
}

async function startHub() {
  const token = getAccessToken();
  if (!token || token.startsWith("stub-")) return;
  if (connection?.state === HubConnectionState.Connected && connectedToken === token) return;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    if (connection) await stopHub();
    connectedToken = token;
    const hub = new HubConnectionBuilder()
      .withUrl(hubUrl(), { accessTokenFactory: () => getAccessToken() ?? "" })
      .withAutomaticReconnect()
      .configureLogging(realtimeLogger)
      .build();
    hub.on(HUB_EVENT, applyServerNotification);
    hub.onreconnected(() => {
      void joinGroup(hub);
    });
    connection = hub;
    await hub.start();
    await joinGroup(hub);
  })()
    .catch(() => {
      connection = null;
      connectedToken = null;
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

/**
 * Connects to the backend notifications hub for the signed-in user and mirrors every pushed
 * notification into the local notification feed. Returns an unsubscribe function.
 */
export function subscribePlatformNotificationRealtime(): () => void {
  subscribers += 1;
  void startHub();
  return () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) void stopHub();
  };
}
