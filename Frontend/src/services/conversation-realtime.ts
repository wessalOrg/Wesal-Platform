import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { subscribeMockMessages } from "@/services/conversations-mock";
import { getAccessToken } from "@/lib/auth-token";
import type { IncomingRealtimeMessage, ThreadMessage } from "@/types/messages";

type MessageHandler = (payload: IncomingRealtimeMessage) => void;

function usesMockRealtime(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

type MessageReceivedDto = {
  messageId?: string;
  conversationId?: string;
  senderUserId?: string;
  senderName?: string;
  content?: string;
  sentAt?: string;
};

function conversationHubUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1";
  try {
    return `${new URL(apiBase).origin}/hubs/conversation`;
  } catch {
    return "http://localhost:5298/hubs/conversation";
  }
}

function mapRealtime(data: MessageReceivedDto): IncomingRealtimeMessage | null {
  const conversationId = String(data.conversationId ?? "");
  const id = String(data.messageId ?? "");
  const content = (data.content ?? "").trim();
  if (!conversationId || !id || !content) return null;
  const message: ThreadMessage = {
    id,
    senderUserId: data.senderUserId ?? "",
    senderName: (data.senderName ?? "").trim() || "",
    content,
    sentAt: data.sentAt ?? new Date().toISOString(),
    delivery: "sent",
  };
  return { conversationId, message };
}

const handlersByConversation = new Map<string, Set<MessageHandler>>();
let connection: HubConnection | null = null;
let startPromise: Promise<HubConnection | null> | null = null;
let boundConnection: HubConnection | null = null;
let connectedToken: string | null = null;

function bindHubEvents(hub: HubConnection) {
  if (boundConnection === hub) return;
  boundConnection = hub;
  hub.on("MessageReceived", (raw: MessageReceivedDto) => {
    const payload = mapRealtime(raw);
    if (!payload) return;
    handlersByConversation.get(payload.conversationId)?.forEach((handler) => handler(payload));
  });
  hub.onreconnected(() => {
    for (const id of handlersByConversation.keys()) {
      void hub.invoke("JoinConversation", id).catch(() => undefined);
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
      .configureLogging(LogLevel.Warning)
      .build();
    await connection.start();
    bindHubEvents(connection);
    return connection;
  })().finally(() => {
    startPromise = null;
  });

  return startPromise;
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
