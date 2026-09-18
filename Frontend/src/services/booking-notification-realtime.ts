import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { getAccessToken } from "@/lib/auth-token";
import {
  parseBookingRequestRealtimeEvent,
  type BookingRequestRealtimeEvent,
} from "@/lib/booking-notification-realtime";

export const OWNER_BOOKING_REQUEST_EVENT = "wesal:booking-request-notification";

const HUB_EVENTS = [
  "BookingRequestReceived",
  "BookingRequestCreated",
  "NewBookingRequest",
  "OwnerBookingNotification",
  "BookingNotification",
] as const;

type EventHandler = (event: BookingRequestRealtimeEvent) => void;

const handlers = new Set<EventHandler>();
let connection: HubConnection | null = null;
let startPromise: Promise<HubConnection | null> | null = null;
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
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1";
  try {
    return `${new URL(apiBase).origin}/hubs/owner-dashboard`;
  } catch {
    return "http://localhost:5298/hubs/owner-dashboard";
  }
}

function publish(raw: unknown) {
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

function bindHubEvents(hub: HubConnection) {
  if (boundConnection === hub) return;
  boundConnection = hub;
  for (const name of HUB_EVENTS) {
    hub.on(name, (raw: unknown) => {
      publish(raw);
    });
  }
}

async function ensureHub(): Promise<HubConnection | null> {
  const token = getAccessToken();
  if (!token || token.startsWith("stub-")) return null;
  if (connection?.state === HubConnectionState.Connected && connectedToken === token) {
    bindHubEvents(connection);
    return connection;
  }
  if (startPromise) return startPromise;

  startPromise = (async () => {
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      try {
        await connection.stop();
      } catch {
        /* ignore stale socket */
      }
    }
    connectedToken = token;
    boundConnection = null;
    connection = new HubConnectionBuilder()
      .withUrl(notificationsHubUrl(), {
        accessTokenFactory: () => getAccessToken() ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build();
    await connection.start();
    bindHubEvents(connection);
    connection.onreconnected(() => {
      void connection?.invoke("JoinOwnerGroup").catch(() => undefined);
    });
    await connection.invoke("JoinOwnerGroup").catch(() => undefined);
    return connection;
  })()
    .catch(() => {
      connection = null;
      boundConnection = null;
      connectedToken = null;
      return null;
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

async function stopHub() {
  const hub = connection;
  connection = null;
  boundConnection = null;
  connectedToken = null;
  startPromise = null;
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

  if (!usesMockRealtime() && handlers.size === 1) {
    void ensureHub();
  }

  return () => {
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
