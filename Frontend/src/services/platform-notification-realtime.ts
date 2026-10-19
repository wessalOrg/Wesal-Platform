import { HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { apiOrigin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { realtimeLogger } from "@/lib/realtime-logger";
import { mapServerNotification } from "@/lib/platform-notification-mapper";
import { pushPlatformNotification } from "@/lib/platform-notifications-store";

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

/** Converts one server notification into the local feed. Unknown kinds are ignored. */
export function applyServerNotification(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const event = raw as ServerNotificationEvent;
  const mapped = mapServerNotification(event);
  if (!mapped) return;

  pushPlatformNotification({
    type: mapped.type,
    audience: mapped.audience,
    title: mapped.title,
    body: mapped.body,
    actionLabel: mapped.actionLabel,
    action_url: mapped.action_url,
    metadata: mapped.metadata,
    tone: mapped.tone,
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
