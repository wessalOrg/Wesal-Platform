import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";

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
    hallName: data.hallName?.trim() || "قاعة",
    initiatorUserId: data.initiatorUserId ?? "",
    ownerUserId: data.ownerUserId ?? "",
    createdAt: data.createdAt ?? new Date().toISOString(),
    isExisting: Boolean(data.isExisting),
  };
}

export async function createHallConversation(hallId: string): Promise<ConversationThread> {
  const { data } = await api.post<ConversationResponse>(
    "/conversations",
    { hallId },
    { timeout: 8000 },
  );
  const thread = mapResponse(data, hallId);
  if (!thread.conversationId) {
    throw new ApiError("تعذر إنشاء المحادثة.", 500);
  }
  return thread;
}

export async function fetchConversation(conversationId: string): Promise<ConversationThread> {
  const { data } = await api.get<ConversationResponse>(`/conversations/${conversationId}`, {
    timeout: 8000,
  });
  return mapResponse(data, "");
}

export function conversationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const raw = (err.message ?? "").toLowerCase();
    if (err.status === 401) {
      return "يجب تسجيل الدخول للتواصل مع صاحب القاعة.";
    }
    if (err.status === 403) {
      if (raw.includes("own hall") || raw.includes("yourself") || raw.includes("your own")) {
        return "لا يمكنك مراسلة قاعتك.";
      }
      return "لا يمكنك مراسلة هذه القاعة من حسابك.";
    }
    if (err.status === 404) {
      return "هذه القاعة غير متاحة أو مقفلة، ولا يمكن التواصل معها.";
    }
    return err.message || "تعذر بدء المحادثة. حاولي مرة أخرى.";
  }
  return "تعذر بدء المحادثة. حاولي مرة أخرى.";
}
