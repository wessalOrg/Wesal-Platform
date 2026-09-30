import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { t } from "@/i18n";
import {
  mockCreateHallConversation,
  mockFetchConversation,
  mockFetchInbox,
  mockFetchThread,
  mockMarkConversationAsRead,
  mockSendAttachment,
  mockSendMessage,
} from "@/services/conversations-mock";
import {
  mapInboxItemDto,
  mapSendMessageDto,
  mapThreadDto,
  unwrapConversationList,
} from "@/lib/conversation-mapper";
import type { ConversationSummary, MessageThread, ThreadMessage } from "@/types/messages";

export type { ConversationSummary, MessageThread, ThreadMessage };

/** Live JWT talks to conversation APIs. Demo stub tokens stay on the mock store (demo mode only). */
export function conversationsUseMock(): boolean {
  if (!isDemoModeEnabled()) return false;
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
  ConversationId?: string;
  id?: string;
  Id?: string;
  hallId?: string;
  HallId?: string;
  hallName?: string;
  HallName?: string;
  initiatorUserId?: string;
  InitiatorUserId?: string;
  ownerUserId?: string;
  OwnerUserId?: string;
  createdAt?: string;
  CreatedAt?: string;
  isExisting?: boolean;
  IsExisting?: boolean;
};

function mapResponse(data: ConversationResponse | null | undefined, fallbackHallId: string): ConversationThread {
  const dto = data ?? {};
  return {
    conversationId: String(dto.conversationId ?? dto.ConversationId ?? dto.id ?? dto.Id ?? ""),
    hallId: String(dto.hallId ?? dto.HallId ?? fallbackHallId),
    hallName: (dto.hallName ?? dto.HallName)?.trim() || t("common.hall"),
    initiatorUserId: dto.initiatorUserId ?? dto.InitiatorUserId ?? "",
    ownerUserId: dto.ownerUserId ?? dto.OwnerUserId ?? "",
    createdAt: dto.createdAt ?? dto.CreatedAt ?? new Date().toISOString(),
    isExisting: Boolean(dto.isExisting ?? dto.IsExisting),
  };
}

export async function createHallConversation(hallId: string): Promise<ConversationThread> {
  if (conversationsUseMock()) {
    return mockCreateHallConversation(hallId);
  }
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

function mapInboxItem(data: unknown): ConversationSummary | null {
  return mapInboxItemDto(data);
}

export async function fetchInboxConversations(): Promise<ConversationSummary[]> {
  if (conversationsUseMock()) return mockFetchInbox();
  const { data } = await api.get<unknown>("/conversations", { timeout: 8000 });
  return unwrapConversationList(data)
    .map(mapInboxItem)
    .filter((item): item is ConversationSummary => Boolean(item));
}

export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  return fetchInboxConversations();
}

export async function fetchConversationThread(conversationId: string): Promise<MessageThread> {
  if (conversationsUseMock()) return mockFetchThread(conversationId);
  const { data } = await api.get<unknown>(`/conversations/${conversationId}/messages`, {
    timeout: 8000,
  });
  return mapThreadDto(data, conversationId);
}

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

  const { data } = await api.post<unknown>(
    `/conversations/${conversationId}/messages`,
    { content: trimmed, clientRequestId },
    { timeout: 8000 },
  );
  const mapped = mapSendMessageDto(data, trimmed, clientRequestId);
  if (!mapped) {
    throw new ApiError(t("errors.send.failed"), 500);
  }
  return mapped;
}

export async function sendConversationAttachment(
  conversationId: string,
  file: File,
  content: string,
  clientRequestId: string,
): Promise<ThreadMessage> {
  const caption = content.trim();
  if (caption.length > 1000) {
    throw new ApiError(t("errors.send.tooLong"), 400);
  }
  if (conversationsUseMock()) {
    return mockSendAttachment(conversationId, file, caption, clientRequestId);
  }

  const formData = new FormData();
  formData.append("file", file);
  if (caption) formData.append("content", caption);
  formData.append("clientRequestId", clientRequestId);

  const { data } = await api.post<unknown>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/attachment`,
    formData,
    {
      timeout: 60000,
      transformRequest: [
        (body, headers) => {
          if (typeof FormData !== "undefined" && body instanceof FormData) {
            if (headers && typeof headers === "object") {
              delete (headers as Record<string, unknown>)["Content-Type"];
            }
          }
          return body;
        },
      ],
    },
  );
  const mapped = mapSendMessageDto(data, caption, clientRequestId);
  if (!mapped) {
    throw new ApiError(t("errors.send.failed"), 500);
  }
  return { ...mapped, hasAttachment: true };
}

export type ConversationErrorScope = "start" | "inbox" | "thread" | "send";

export async function fetchUnreadConversationCount(): Promise<number> {
  if (conversationsUseMock()) return 0;
  const { data } = await api.get<unknown>("/conversations/unread-count", { timeout: 8000 });
  const root = data && typeof data === "object" ? (data as { unreadCount?: unknown; UnreadCount?: unknown }) : null;
  const count = root?.unreadCount ?? root?.UnreadCount;
  return typeof count === "number" ? count : 0;
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  if (conversationsUseMock()) {
    await mockMarkConversationAsRead(conversationId);
    return;
  }
  await api.post(`/conversations/${encodeURIComponent(conversationId)}/read`, undefined, {
    timeout: 8000,
  });
}

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
