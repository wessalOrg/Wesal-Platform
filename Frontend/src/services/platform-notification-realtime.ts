import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { apiOrigin } from "@/lib/api";
import { realtimeLogger } from "@/lib/realtime-logger";
import {
  isCurrentNotificationAccount,
  readNotificationAccount,
  subscribeNotificationAccount,
  type NotificationAccount,
} from "@/lib/notification-account";
import { mapServerNotification } from "@/lib/platform-notification-mapper";
import { pushPlatformNotification } from "@/lib/platform-notifications-store";
import { isEventRequestNotificationKind } from "@/lib/event-request-notification";
import { currentNotificationRequests } from "@/lib/notification-requests";

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
  conversationId?: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  messagePreview?: string | null;
  messageCount?: number | null;
};

/** Converts one server notification into the local feed. Unknown kinds are ignored. */
export function applyServerNotification(raw: unknown, account = readNotificationAccount()): void {
  if (!isCurrentNotificationAccount(account) || !raw || typeof raw !== "object") return;
  const event = raw as ServerNotificationEvent & Record<string, unknown>;
  if (isEventRequestNotificationKind(event.kind)) {
    // EventRequestService persists before dispatch. REST owns the real ID, timestamp and read state.
    // If no inbox consumer is mounted yet, its initial hydration retrieves these durable rows.
    void currentNotificationRequests(account)?.refreshEventRequests();
    return;
  }
  const mapped = mapServerNotification({
    kind: event.kind,
    title: event.title,
    body: event.body,
    actionLabel: event.actionLabel,
    actionTarget: event.actionTarget,
    targetId: event.targetId,
    conversationId:
      (typeof event.conversationId === "string" && event.conversationId) ||
      (typeof event.ConversationId === "string" ? event.ConversationId : null),
    senderName:
      (typeof event.senderName === "string" && event.senderName) ||
      (typeof event.SenderName === "string" ? event.SenderName : null),
    senderAvatarUrl:
      (typeof event.senderAvatarUrl === "string" && event.senderAvatarUrl) ||
      (typeof event.SenderAvatarUrl === "string" ? event.SenderAvatarUrl : null),
    messagePreview:
      (typeof event.messagePreview === "string" && event.messagePreview) ||
      (typeof event.MessagePreview === "string" ? event.MessagePreview : null),
    messageCount:
      typeof event.messageCount === "number"
        ? event.messageCount
        : typeof event.MessageCount === "number"
          ? event.MessageCount
          : null,
  });
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
    // §13.5 — live MessageNotificationBanner owns the popup for new messages.
    toast: mapped.type === "new_message" ? false : undefined,
  }, account);
}

const HUB_EVENT = "NotificationReceived";

type NotificationHub = {
  account: NotificationAccount;
  connection: HubConnection;
  subscribers: number;
  active: boolean;
  unsubscribe: () => void;
};
let currentHub: NotificationHub | null = null;

function hubUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_NOTIFICATIONS_HUB_URL?.trim();
  return explicit || `${apiOrigin()}/hubs/notifications`;
}

async function joinGroup(hub: HubConnection) {
  await hub.invoke("JoinNotificationsGroup").catch(() => undefined);
}

function stopHub(record: NotificationHub) {
  record.active = false;
  record.unsubscribe();
  if (currentHub === record) currentHub = null;
  void record.connection.stop().catch(() => undefined);
}

function startHub(account: NotificationAccount): NotificationHub {
  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: () =>
      isCurrentNotificationAccount(account) ? account.token : "" })
    .withAutomaticReconnect()
    .configureLogging(realtimeLogger)
    .build();
  const record: NotificationHub = { account, connection, subscribers: 0, active: true, unsubscribe: () => undefined };
  currentHub = record;
  const valid = () => record.active && currentHub === record && isCurrentNotificationAccount(account);
  record.unsubscribe = subscribeNotificationAccount(() => {
    if (!isCurrentNotificationAccount(account)) stopHub(record);
  });
  connection.on(HUB_EVENT, (raw: unknown) => {
    if (valid()) applyServerNotification(raw, account);
  });
  connection.onreconnected(() => {
    if (valid()) void joinGroup(connection);
  });
  void connection.start().then(() => {
    if (valid()) return joinGroup(connection);
    return connection.stop();
  }).catch(() => { if (valid()) stopHub(record); });
  return record;
}

/**
 * Connects to the backend notifications hub for the signed-in user and mirrors every pushed
 * notification into the local notification feed. Returns an unsubscribe function.
 */
export function subscribePlatformNotificationRealtime(): () => void {
  const account = readNotificationAccount();
  if (!account || account.token.startsWith("stub-")) return () => undefined;
  if (currentHub && currentHub.account !== account) stopHub(currentHub);
  const record = currentHub ?? startHub(account);
  record.subscribers += 1;
  return () => {
    record.subscribers -= 1;
    if (record.subscribers === 0) stopHub(record);
  };
}
