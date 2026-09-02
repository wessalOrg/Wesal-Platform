import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";

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
  const { data } = await api.get<ConversationResponse>(`/conversations/${conversationId}`, {
    timeout: 8000,
  });
  return mapResponse(data, "");
}

export type ConversationSummary = {
  conversationId: string;
  hallId: string;
  hallName: string;
  otherParticipantName: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
};

type ConversationSummaryResponse = {
  conversationId?: string;
  hallId?: string;
  hallName?: string;
  otherParticipantName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string | null;
  messageCount?: number;
  createdAt?: string;
};

export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummaryResponse[]>("/conversations", {
    timeout: 8000,
  });

  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    conversationId: String(item.conversationId ?? ""),
    hallId: String(item.hallId ?? ""),
    hallName: item.hallName?.trim() || t("common.hall"),
    otherParticipantName: item.otherParticipantName?.trim() || t("common.user"),
    lastMessagePreview: item.lastMessagePreview?.trim() || "",
    lastMessageAt: item.lastMessageAt ?? null,
    messageCount: Number(item.messageCount ?? 0),
    createdAt: item.createdAt ?? new Date().toISOString(),
  }));
}

export function conversationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return t("errors.conversation.unauthorized");
    }
    if (err.status === 403) {
      return t("errors.conversation.forbidden");
    }
    if (err.status === 404) {
      return t("errors.conversation.notFound");
    }
    return err.message || t("errors.conversation.start");
  }
  return t("errors.conversation.start");
}
