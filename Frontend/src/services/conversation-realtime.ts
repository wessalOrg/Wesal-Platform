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

const handlersByConversation = new Map<string, Set<MessageHandler>>();
const inboxHandlers = new Set<MessageHandler>();
const unreadHandlers = new Set<UnreadHandler>();
let openConversationId: string | null = null;

function dispatchMessage(payload: IncomingRealtimeMessage) {
  handlersByConversation.get(payload.conversationId)?.forEach((handler) => handler(payload));
  inboxHandlers.forEach((handler) => handler(payload));
}

function dispatchUnread(payload: UnreadCountsPayload) {
  unreadHandlers.forEach((handler) => handler(payload));
}

let connection: HubConnection | null = null;
let startPromise: Promise<HubConnection | null> | null = null;
let boundConnection: HubConnection | null = null;
let connectedToken: string | null = null;

function bindHubEvents(hub: HubConnection) {
  if (boundConnection === hub) return;
  boundConnection = hub;
  hub.on("MessageReceived", (raw: unknown) => {
    const payload = mapRealtime(raw);
    if (!payload) return;
    dispatchMessage(payload);
  });
  hub.on("UnreadCountsUpdated", (raw: unknown) => {
    const payload = mapUnreadCounts(raw);
    if (!payload) return;
    dispatchUnread(payload);
  });
  hub.onreconnected(() => {
    for (const id of handlersByConversation.keys()) {
      void hub.invoke("JoinConversation", id).catch(() => undefined);
    }
    if (openConversationId) {
      void hub.invoke("SetConversationOpen", openConversationId, true).catch(() => undefined);
    }
  });
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
      .withUrl(conversationHubUrl(), {
        accessTokenFactory: () => getAccessToken() ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(realtimeLogger)
      .build();
    await connection.start();
    bindHubEvents(connection);
    return connection;
  })().finally(() => {
    startPromise = null;
  });

  return startPromise;
}

/** Live messages for the signed-in user, including threads that are not open. */
export function subscribeIncomingMessages(onMessage: MessageHandler): () => void {
  if (usesMockRealtime()) {
    return subscribeMockMessages(onMessage);
  }

  inboxHandlers.add(onMessage);
  void ensureHub().catch(() => undefined);
  return () => {
    inboxHandlers.delete(onMessage);
  };
}

/** Server-pushed unread totals / per-conversation counters. */
export function subscribeUnreadCounts(onUpdate: UnreadHandler): () => void {
  if (usesMockRealtime()) return () => undefined;
  unreadHandlers.add(onUpdate);
  void ensureHub().catch(() => undefined);
  return () => {
    unreadHandlers.delete(onUpdate);
  };
}

/**
 * Tell the hub which conversation the user is actively reading so it can
 * suppress push alerts and keep unread counters accurate.
 */
export function setConversationOpen(conversationId: string | null): void {
  const next = conversationId?.trim() || null;
  const previous = openConversationId;
  openConversationId = next;
  if (usesMockRealtime()) return;

  void (async () => {
    try {
      const hub = await ensureHub();
      if (!hub) return;
      if (previous && previous !== next) {
        await hub.invoke("SetConversationOpen", previous, false).catch(() => undefined);
      }
      if (next) {
        await hub.invoke("SetConversationOpen", next, true).catch(() => undefined);
      }
    } catch {
      /* REST mark-read still works if the hub call fails. */
    }
  })();
}

/** Hub mark-read (alongside REST) so UnreadCountsUpdated stays in sync. */
export function markConversationReadOnHub(conversationId: string): void {
  const id = conversationId.trim();
  if (!id || usesMockRealtime()) return;
  void (async () => {
    try {
      const hub = await ensureHub();
      if (!hub) return;
      await hub.invoke("MarkConversationRead", id).catch(() => undefined);
    } catch {
      /* REST mark-read is the source of truth if hub invoke fails. */
    }
  })();
}

export function subscribeConversationMessages(
  conversationId: string,
  onMessage: MessageHandler,
): () => void {
  if (!conversationId) return () => undefined;

  if (usesMockRealtime()) {
    return subscribeMockMessages((payload) => {
      if (payload.conversationId !== conversationId) return;
      onMessage(payload);
    });
  }

  let set = handlersByConversation.get(conversationId);
  if (!set) {
    set = new Set();
    handlersByConversation.set(conversationId, set);
  }
  const shouldJoin = set.size === 0;
  set.add(onMessage);

  void (async () => {
    try {
      const hub = await ensureHub();
      if (!hub || !handlersByConversation.get(conversationId)?.has(onMessage)) return;
      if (shouldJoin) {
        await hub.invoke("JoinConversation", conversationId);
      }
    } catch {
      /* REST send still works if the socket cannot join. */
    }
  })();

  return () => {
    const live = handlersByConversation.get(conversationId);
    live?.delete(onMessage);
    if (live && live.size === 0) {
      handlersByConversation.delete(conversationId);
      if (connection?.state === HubConnectionState.Connected) {
        void connection.invoke("LeaveConversation", conversationId).catch(() => undefined);
      }
    }
  };
}
