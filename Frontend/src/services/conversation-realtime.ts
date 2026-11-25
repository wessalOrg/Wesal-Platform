import {
  isCurrentAuthenticatedAccount, readAuthenticatedAccount, subscribeAuthenticatedAccount,
  type AuthenticatedAccount,
} from "@/lib/authenticated-account";
import { HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { apiOrigin } from "@/lib/api";
import { mapRealtimeMessageDto } from "@/lib/conversation-mapper";
import { realtimeLogger } from "@/lib/realtime-logger";
import { subscribeMockMessages } from "@/services/conversations-mock";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type { IncomingRealtimeMessage } from "@/types/messages";

type MessageHandler = (payload: IncomingRealtimeMessage) => void;
export type UnreadCountsPayload = {
  conversationId?: string | null;
  unreadMessageCount?: number;
  totalUnreadCount?: number;
};
type UnreadHandler = (payload: UnreadCountsPayload) => void;

function usesMockRealtime(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

function conversationHubUrl(): string {
  return `${apiOrigin()}/hubs/conversation`;
}

function mapRealtime(data: unknown): IncomingRealtimeMessage | null {
  return mapRealtimeMessageDto(data);
}

function mapUnreadCounts(data: unknown): UnreadCountsPayload | null {
  if (!data || typeof data !== "object") return null;
  const dto = data as Record<string, unknown>;
  const conversationId =
    typeof dto.conversationId === "string"
      ? dto.conversationId
      : typeof dto.ConversationId === "string"
        ? dto.ConversationId
        : null;
  const unreadMessageCount =
    typeof dto.unreadMessageCount === "number"
      ? dto.unreadMessageCount
      : typeof dto.UnreadMessageCount === "number"
        ? dto.UnreadMessageCount
        : typeof dto.unreadCount === "number"
          ? dto.unreadCount
          : typeof dto.UnreadCount === "number"
            ? dto.UnreadCount
            : undefined;
  const totalUnreadCount =
    typeof dto.totalUnreadCount === "number"
      ? dto.totalUnreadCount
      : typeof dto.TotalUnreadCount === "number"
        ? dto.TotalUnreadCount
        : undefined;
  if (
    conversationId == null &&
    unreadMessageCount == null &&
    totalUnreadCount == null
  ) {
    return null;
  }
  return { conversationId, unreadMessageCount, totalUnreadCount };
}

/** One transport and its consumers belong to one continuous authenticated login. */
type ConversationHub = {
  account: AuthenticatedAccount;
  connection: HubConnection;
  active: boolean;
  startPromise: Promise<HubConnection | null> | null;
  inbox: Set<MessageHandler>;
  unread: Set<UnreadHandler>;
  threads: Map<string, Set<MessageHandler>>;
  joined: Set<string>;
  memberships: Map<string, Promise<void>>;
  openConversationId: string | null;
  sentOpenConversationId: string | null;
  presence: Promise<void>;
  unsubscribeAccount: () => void;
};
let currentHub: ConversationHub | null = null;

function isCurrent(record: ConversationHub): boolean {
  return record.active && currentHub === record && isCurrentAuthenticatedAccount(record.account);
}

function stopHub(record: ConversationHub): void {
  if (!record.active) return;
  record.active = false;
  if (currentHub === record) currentHub = null;
  record.unsubscribeAccount();
  record.connection.off("MessageReceived");
  record.connection.off("UnreadCountsUpdated");
  record.inbox.clear();
  record.unread.clear();
  record.threads.clear();
  record.joined.clear();
  record.memberships.clear();
  record.openConversationId = null;
  // Invalidate synchronously; transport shutdown can finish after the next login starts.
  void record.connection.stop().catch(() => undefined);
}

function releaseUnusedHub(record: ConversationHub): void {
  if (!record.inbox.size && !record.unread.size && !record.threads.size && !record.openConversationId) {
    stopHub(record);
  }
}

/** Serialize join/leave so an unfinished join cannot outlive its last subscriber. */
function syncMembership(record: ConversationHub, id: string): void {
  const previous = record.memberships.get(id) ?? Promise.resolve();
  const operation = previous.then(async () => {
    if (!isCurrent(record) || record.connection.state !== HubConnectionState.Connected) return;
    const wanted = Boolean(record.threads.get(id)?.size);
    if (wanted && !record.joined.has(id)) {
      await record.connection.invoke("JoinConversation", id);
      if (isCurrent(record)) record.joined.add(id);
    } else if (!wanted && record.joined.has(id)) {
      await record.connection.invoke("LeaveConversation", id);
      if (isCurrent(record)) record.joined.delete(id);
    }
  }).catch(() => undefined);
  record.memberships.set(id, operation);
  void operation.then(() => {
    if (record.memberships.get(id) === operation) record.memberships.delete(id);
  });
}

function syncPresence(record: ConversationHub): void {
  record.presence = record.presence.then(async () => {
    if (!isCurrent(record) || record.connection.state !== HubConnectionState.Connected) return;
    const previous = record.sentOpenConversationId;
    if (previous && previous !== record.openConversationId) {
      await record.connection.invoke("SetConversationOpen", previous, false);
      if (!isCurrent(record)) return;
      record.sentOpenConversationId = null;
    }
    const next = record.openConversationId;
    if (next && next !== record.sentOpenConversationId && isCurrent(record)) {
      await record.connection.invoke("SetConversationOpen", next, true);
      if (isCurrent(record)) record.sentOpenConversationId = next;
    }
  }).catch(() => undefined);
}

function restoreSubscriptions(record: ConversationHub): void {
  for (const id of record.threads.keys()) syncMembership(record, id);
  syncPresence(record);
}

function ensureStarted(record: ConversationHub): Promise<HubConnection | null> {
  if (!isCurrent(record)) return Promise.resolve(null);
  if (record.connection.state === HubConnectionState.Connected) return Promise.resolve(record.connection);
  if (record.startPromise) return record.startPromise;
  // Automatic reconnect owns the transport until it succeeds or closes.
  if (record.connection.state !== HubConnectionState.Disconnected) return Promise.resolve(null);
  const pending = record.connection.start().then(async () => {
    if (!isCurrent(record)) {
      // Some transports finish start after stop was requested. Never resurrect that hub.
      await record.connection.stop().catch(() => undefined);
      return null;
    }
    restoreSubscriptions(record);
    return record.connection;
  }).catch(() => null).finally(() => {
    if (record.startPromise === pending) record.startPromise = null;
  });
  record.startPromise = pending;
  return pending;
}

function getHub(): ConversationHub | null {
  const account = readAuthenticatedAccount();
  if (currentHub && currentHub.account !== account) stopHub(currentHub);
  if (!account || account.token.startsWith("stub-")) return null;
  if (currentHub) return currentHub;
  const connection = new HubConnectionBuilder()
    .withUrl(conversationHubUrl(), {
      accessTokenFactory: () => isCurrent(record) ? account.token : "",
    })
    .withAutomaticReconnect()
    .configureLogging(realtimeLogger)
    .build();
  const record: ConversationHub = {
    account, connection, active: true, startPromise: null,
    inbox: new Set(), unread: new Set(), threads: new Map(), joined: new Set(), memberships: new Map(),
    openConversationId: null, sentOpenConversationId: null, presence: Promise.resolve(),
    unsubscribeAccount: () => undefined,
  };
  currentHub = record;
  record.unsubscribeAccount = subscribeAuthenticatedAccount(() => {
    if (!isCurrentAuthenticatedAccount(account)) stopHub(record);
  });
  connection.on("MessageReceived", (raw: unknown) => {
    if (!isCurrent(record)) return;
    const payload = mapRealtime(raw);
    if (!payload) return;
    // Recheck for each consumer: a callback may itself log out or switch accounts.
    record.threads.get(payload.conversationId)?.forEach(handler => { if (isCurrent(record)) handler(payload); });
    record.inbox.forEach(handler => { if (isCurrent(record)) handler(payload); });
  });
  connection.on("UnreadCountsUpdated", (raw: unknown) => {
    if (!isCurrent(record)) return;
    const payload = mapUnreadCounts(raw);
    if (payload) record.unread.forEach(handler => { if (isCurrent(record)) handler(payload); });
  });
  connection.onreconnected(() => {
    if (!isCurrent(record)) return;
    record.joined.clear();
    record.sentOpenConversationId = null;
    restoreSubscriptions(record);
  });
  connection.onclose(() => {
    record.joined.clear();
    record.sentOpenConversationId = null;
  });
  return record;
}

function subscribeAccountMock(onMessage: MessageHandler): () => void {
  const account = readAuthenticatedAccount();
  if (!account) return () => undefined;
  let active = true;
  const unsubscribe = subscribeMockMessages(payload => {
    if (active && isCurrentAuthenticatedAccount(account)) onMessage(payload);
  });
  let unsubscribeAccount: () => void = () => undefined;
  const dispose = () => { active = false; unsubscribe(); unsubscribeAccount(); };
  unsubscribeAccount = subscribeAuthenticatedAccount(() => {
    if (!isCurrentAuthenticatedAccount(account)) dispose();
  });
  return dispose;
}

/** Live messages for the signed-in user, including threads that are not open. */
export function subscribeIncomingMessages(onMessage: MessageHandler): () => void {
  if (usesMockRealtime()) return subscribeAccountMock(onMessage);
  const record = getHub();
  if (!record) return () => undefined;
  record.inbox.add(onMessage);
  void ensureStarted(record);
  return () => { record.inbox.delete(onMessage); releaseUnusedHub(record); };
}

/** Server-pushed unread totals / per-conversation counters. */
export function subscribeUnreadCounts(onUpdate: UnreadHandler): () => void {
  if (usesMockRealtime()) return () => undefined;
  const record = getHub();
  if (!record) return () => undefined;
  record.unread.add(onUpdate);
  void ensureStarted(record);
  return () => { record.unread.delete(onUpdate); releaseUnusedHub(record); };
}

/** Tell the current account's hub which conversation is actively being read. */
export function setConversationOpen(conversationId: string | null): void {
  if (usesMockRealtime()) return;
  const next = conversationId?.trim() || null;
  const record = next ? getHub() : currentHub;
  if (!record || !isCurrent(record)) return;
  record.openConversationId = next;
  void ensureStarted(record).then(hub => {
    if (hub && isCurrent(record)) syncPresence(record);
    releaseUnusedHub(record);
  });
}

/** Hub mark-read supplements REST, which remains the source of truth. */
export function markConversationReadOnHub(conversationId: string): void {
  const id = conversationId.trim();
  if (!id || usesMockRealtime()) return;
  const record = getHub();
  if (!record) return;
  void ensureStarted(record).then(async hub => {
    if (hub && isCurrent(record)) await hub.invoke("MarkConversationRead", id);
  }).catch(() => undefined).finally(() => releaseUnusedHub(record));
}

export function subscribeConversationMessages(conversationId: string, onMessage: MessageHandler): () => void {
  if (!conversationId) return () => undefined;
  if (usesMockRealtime()) return subscribeAccountMock(payload => {
    if (payload.conversationId === conversationId) onMessage(payload);
  });
  const record = getHub();
  if (!record) return () => undefined;
  let handlers = record.threads.get(conversationId);
  if (!handlers) { handlers = new Set(); record.threads.set(conversationId, handlers); }
  handlers.add(onMessage);
  void ensureStarted(record).then(hub => {
    if (hub && isCurrent(record)) syncMembership(record, conversationId);
  });
  return () => {
    const handlers = record.threads.get(conversationId);
    handlers?.delete(onMessage);
    if (handlers && !handlers.size) {
      record.threads.delete(conversationId);
      syncMembership(record, conversationId);
    }
    releaseUnusedHub(record);
  };
}
