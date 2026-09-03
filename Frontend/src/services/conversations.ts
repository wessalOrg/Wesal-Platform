import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { t } from "@/i18n";
import { mockFetchConversation, mockFetchInbox, mockFetchThread, mockSendMessage } from "@/services/conversations-mock";
import type { ConversationSummary, MessageThread, ThreadMessage } from "@/types/messages";

export type { ConversationSummary, MessageThread, ThreadMessage };

/** Live JWT talks to conversation APIs. Demo stub tokens stay on the mock store. */
export function conversationsUseMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

export type ConversationThread = {
  conversationId: string;
  hallId: string;
  hallName: string;
  initiatorUserId: string;
  ownerUserId: string;
  createdAt: string;
  isExisting: boolean;
};

type ConversationResponse = {
  conversationId?: string;
  id?: string;
  hallId?: string;
  hallName?: string;
  initiatorUserId?: string;
  ownerUserId?: string;
  createdAt?: string;
  isExisting?: boolean;
};

function mapResponse(data: ConversationResponse, fallbackHallId: string): ConversationThread {
  return {
    conversationId: String(data.conversationId ?? data.id ?? ""),
    hallId: String(data.hallId ?? fallbackHallId),
    hallName: data.hallName?.trim() || t("common.hall"),
    initiatorUserId: data.initiatorUserId ?? "",
    ownerUserId: data.ownerUserId ?? "",
    createdAt: data.createdAt ?? new Date().toISOString(),
    isExisting: Boolean(data.isExisting),
  };
}

export async function createHallConversation(hallId: string): Promise<ConversationThread> {
  const { data } = await api.post<ConversationResponse>(
    `/halls/${hallId}/conversations`,
    undefined,
    { timeout: 8000 },
  );
  const thread = mapResponse(data, hallId);
  if (!thread.conversationId) {
    throw new ApiError(t("errors.conversation.create"), 500);
  }
  return thread;
}

export async function fetchConversation(conversationId: string): Promise<ConversationThread> {
  if (conversationsUseMock()) {
    return mockFetchConversation(conversationId);
  }
  const { data } = await api.get<ConversationResponse>(`/conversations/${conversationId}`, {
    timeout: 8000,
  });
  return mapResponse(data, "");
}

type InboxDto = {
  conversationId?: string;
  hallId?: string;
  hallName?: string;
  otherParticipantId?: string;
  otherParticipantName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string | null;
  messageCount?: number;
  createdAt?: string;
};

type ThreadMessageDto = {
  id?: string;
  senderUserId?: string;
  senderName?: string;
  content?: string;
  sentAt?: string;
};

type ThreadDto = {
  conversationId?: string;
  hallId?: string;
  hallName?: string;
  messages?: ThreadMessageDto[];
};

function mapInboxItem(data: InboxDto): ConversationSummary | null {
  const conversationId = String(data.conversationId ?? "");
  if (!conversationId) return null;
  return {
    conversationId,
    hallId: String(data.hallId ?? ""),
    hallName: (data.hallName ?? "").trim() || t("common.hall"),
    otherParticipantId: data.otherParticipantId ?? "",
    otherParticipantName: (data.otherParticipantName ?? "").trim() || t("common.user"),
    lastMessagePreview: (data.lastMessagePreview ?? "").trim(),
    lastMessageAt: data.lastMessageAt ?? null,
    messageCount: typeof data.messageCount === "number" ? data.messageCount : 0,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

function mapThreadMessage(data: ThreadMessageDto): ThreadMessage | null {
  const id = String(data.id ?? "");
  const content = (data.content ?? "").trim();
  if (!id || !content) return null;
  return {
    id,
    senderUserId: data.senderUserId ?? "",
    senderName: (data.senderName ?? "").trim() || t("common.user"),
    content,
    sentAt: data.sentAt ?? new Date().toISOString(),
    delivery: "sent",
  };
}

export async function fetchInboxConversations(): Promise<ConversationSummary[]> {
  if (conversationsUseMock()) return mockFetchInbox();
  const { data } = await api.get<InboxDto[]>("/conversations", { timeout: 8000 });
  return (Array.isArray(data) ? data : []).map(mapInboxItem).filter((item): item is ConversationSummary => Boolean(item));
}

export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  return fetchInboxConversations();
}

export async function fetchConversationThread(conversationId: string): Promise<MessageThread> {
  if (conversationsUseMock()) return mockFetchThread(conversationId);
  const { data } = await api.get<ThreadDto>(`/conversations/${conversationId}/messages`, {
    timeout: 8000,
  });
  return {
    conversationId: String(data.conversationId ?? conversationId),
    hallId: String(data.hallId ?? ""),
    hallName: (data.hallName ?? "").trim() || t("common.hall"),
    messages: (data.messages ?? [])
      .map(mapThreadMessage)
      .filter((item): item is ThreadMessage => Boolean(item)),
  };
}

type SendMessageDto = {
  messageId?: string;
  conversationId?: string;
  senderUserId?: string;
  senderName?: string;
  content?: string;
  sentAt?: string;
  isDuplicate?: boolean;
};

export async function sendConversationMessage(
  conversationId: string,
  content: string,
  clientRequestId: string,
): Promise<ThreadMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new ApiError(t("errors.send.empty"), 400);
  }
  if (trimmed.length > 1000) {
    throw new ApiError(t("errors.send.tooLong"), 400);
  }
  if (conversationsUseMock()) {
    return mockSendMessage(conversationId, trimmed, clientRequestId);
  }

  const { data } = await api.post<SendMessageDto>(
    `/conversations/${conversationId}/messages`,
    { content: trimmed, clientRequestId },
    { timeout: 8000 },
  );
  const id = String(data.messageId ?? "");
  if (!id) {
    throw new ApiError(t("errors.send.failed"), 500);
  }
  return {
    id,
    clientRequestId,
    senderUserId: data.senderUserId ?? "",
    senderName: (data.senderName ?? "").trim() || t("common.user"),
    content: (data.content ?? trimmed).trim(),
    sentAt: data.sentAt ?? new Date().toISOString(),
    delivery: "sent",
  };
}

export type ConversationErrorScope = "start" | "inbox" | "thread" | "send";

export function conversationErrorMessage(
  err: unknown,
  scope: ConversationErrorScope = "start",
): string {
  const fallback =
    scope === "inbox"
      ? t("errors.inbox.load")
      : scope === "thread"
        ? t("errors.thread.load")
        : scope === "send"
          ? t("errors.send.failed")
          : t("errors.conversation.start");

  if (err instanceof ApiError) {
    if (err.status === 401) {
      return t("errors.conversation.unauthorized");
    }
    if (err.status === 403) {
      return scope === "start" ? t("errors.conversation.forbidden") : t("errors.conversation.accessDenied");
    }
    if (err.status === 404) {
      return scope === "start" ? t("errors.conversation.notFound") : t("errors.conversation.missing");
    }
    if (scope === "send") {
      return err.message || t("errors.send.failed");
    }
    return err.message || fallback;
  }
  return fallback;
}
