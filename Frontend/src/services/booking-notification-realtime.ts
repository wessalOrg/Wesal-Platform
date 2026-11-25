import { HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { apiOrigin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { realtimeLogger } from "@/lib/realtime-logger";
import { isCurrentNotificationAccount, readNotificationAccount, subscribeNotificationAccount,
  type NotificationAccount } from "@/lib/notification-account";
import {
  parseBookingRequestRealtimeEvent,
  type BookingRequestRealtimeEvent,
} from "@/lib/booking-notification-realtime";

export const OWNER_BOOKING_REQUEST_EVENT = "wesal:booking-request-notification";

const HUB_EVENTS = [
  "BookingRequestReceived",
  "BookingRequestCancelled",
  "BookingRequestCreated",
  "NewBookingRequest",
  "OwnerBookingNotification",
  "BookingNotification",
] as const;

type EventHandler = (event: BookingRequestRealtimeEvent) => void;

const handlers = new Set<EventHandler>();
let connection: HubConnection | null = null;
let startPromise: Promise<HubConnection | null> | null = null;
let startAccount: NotificationAccount | null = null;
let connectionAccount: NotificationAccount | null = null;
let boundConnection: HubConnection | null = null;
let connectedToken: string | null = null;
let windowBound = false;

function usesMockRealtime(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

function notificationsHubUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BOOKING_NOTIFICATIONS_HUB_URL?.trim();
  if (explicit) return explicit;
  return `${apiOrigin()}/hubs/owner-dashboard`;
}

function publish(raw: unknown, account = readNotificationAccount()) {
  if (!isCurrentNotificationAccount(account)) return;
  const event = parseBookingRequestRealtimeEvent(raw);
  if (!event) return;
  handlers.forEach((handler) => handler(event));
}

function onWindowEvent(event: Event) {
  const custom = event as CustomEvent<unknown>;
  publish(custom.detail);
}

function bindWindowBus() {
  if (typeof window === "undefined" || windowBound) return;
  windowBound = true;
  window.addEventListener(OWNER_BOOKING_REQUEST_EVENT, onWindowEvent);
}

function unbindWindowBus() {
  if (typeof window === "undefined" || !windowBound) return;
  windowBound = false;
  window.removeEventListener(OWNER_BOOKING_REQUEST_EVENT, onWindowEvent);
}

function bindHubEvents(hub: HubConnection, account: NotificationAccount) {
  if (boundConnection === hub) return;
  boundConnection = hub;
  for (const name of HUB_EVENTS) {
    hub.on(name, (raw: unknown) => {
      publish(raw, account);
    });
  }
}

async function ensureHub(): Promise<HubConnection | null> {
  const account = readNotificationAccount();
  if (!account || account.token.startsWith("stub-")) return null;
  if (connection?.state === HubConnectionState.Connected && connectionAccount === account && connectedToken === account.token) {
    bindHubEvents(connection, account);
    return connection;
  }
  if (startPromise && startAccount === account) return startPromise;

  const previous = connection;
  const hub = new HubConnectionBuilder()
    .withUrl(notificationsHubUrl(), {
      accessTokenFactory: () => isCurrentNotificationAccount(account) ? account.token : "",
    })
    .withAutomaticReconnect()
    .configureLogging(realtimeLogger)
    .build();
  connection = hub;
  connectionAccount = account;
  connectedToken = account.token;
  boundConnection = null;
  startAccount = account;
  const current = () => connection === hub && isCurrentNotificationAccount(account);
  const operation = (async () => {
    if (previous && previous.state !== HubConnectionState.Disconnected) {
      try {
        await previous.stop();
      } catch {
        /* ignore stale socket */
      }
    }
    if (!current()) return null;
    await hub.start();
    if (!current()) { await hub.stop(); return null; }
    bindHubEvents(hub, account);
    hub.onreconnected(() => {
      if (current()) void hub.invoke("JoinOwnerGroup").catch(() => undefined);
    });
    await hub.invoke("JoinOwnerGroup").catch(() => undefined);
    return current() ? hub : null;
  })()
    .catch(() => {
      if (connection === hub) {
        connection = null;
        connectionAccount = null;
        boundConnection = null;
        connectedToken = null;
      }
      return null;
    })
    .finally(() => {
      if (startPromise === operation) { startPromise = null; startAccount = null; }
    });

  startPromise = operation;
  return operation;
}

async function stopHub() {
  const hub = connection;
  connection = null;
  connectionAccount = null;
  boundConnection = null;
  connectedToken = null;
  startPromise = null;
  startAccount = null;
  if (!hub) return;
  try {
    await hub.stop();
  } catch {
    /* ignore */
  }
}

/**
 * Abdulaziz realtime + in-app event bus.
 * Also accepts `window` CustomEvent `wesal:booking-request-notification`.
 */
export function subscribeOwnerBookingRequestEvents(onEvent: EventHandler): () => void {
  handlers.add(onEvent);
  bindWindowBus();
  const unsubscribeAccount = subscribeNotificationAccount(() => {
    if (!usesMockRealtime() && readNotificationAccount()) void ensureHub();
    else void stopHub();
  });

  if (!usesMockRealtime() && handlers.size === 1) {
    void ensureHub();
  }

  return () => {
    unsubscribeAccount();
    handlers.delete(onEvent);
    if (handlers.size > 0) return;
    unbindWindowBus();
    void stopHub();
  };
}

export function emitOwnerBookingRequestEvent(raw: unknown) {
  if (typeof window === "undefined") {
    publish(raw);
    return;
  }
  window.dispatchEvent(new CustomEvent(OWNER_BOOKING_REQUEST_EVENT, { detail: raw }));
}
