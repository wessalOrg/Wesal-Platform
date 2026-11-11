import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { isProfessionalRole, resolveSessionRole } from "@/lib/account-role";
import { getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";
import { conversationTimeValue, mapInboxItemDto, mapSendMessageDto, mapThreadDto, unwrapConversationList } from "@/lib/conversation-mapper";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { t } from "@/i18n";
import {
  mockCreateHallConversation,
  mockFetchInbox,
  mockFetchThread,
  mockMarkConversationAsRead,
  mockSendAttachment,
  mockSendMessage,
  mockUnreadConversationCount,
} from "@/services/conversations-mock";
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
  contextPostId: string | null;
  contextOfferId: string | null;
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
  contextPostId?: string | null;
  ContextPostId?: string | null;
  contextOfferId?: string | null;
  ContextOfferId?: string | null;
};

function mapResponse(
  data: ConversationResponse | null | undefined,
  fallbackHallId = "",
): ConversationThread {
  const dto = data ?? {};
  return {
    conversationId: String(dto.conversationId ?? dto.ConversationId ?? dto.id ?? dto.Id ?? ""),
    hallId: String(dto.hallId ?? dto.HallId ?? fallbackHallId ?? ""),
    hallName:
      (dto.hallName ?? dto.HallName)?.trim() ||
      (fallbackHallId ? t("common.hall") : ""),
    initiatorUserId: dto.initiatorUserId ?? dto.InitiatorUserId ?? "",
    ownerUserId: dto.ownerUserId ?? dto.OwnerUserId ?? "",
    createdAt: dto.createdAt ?? dto.CreatedAt ?? new Date().toISOString(),
    isExisting: Boolean(dto.isExisting ?? dto.IsExisting),
    contextPostId: String(dto.contextPostId ?? dto.ContextPostId ?? "").trim() || null,
    contextOfferId: String(dto.contextOfferId ?? dto.ContextOfferId ?? "").trim() || null,
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

/**
 * Customer ↔ approved professional thread
 * (`POST /professionals/{providerUserId}/conversations`, ConversationKind.CustomerProvider).
 * Idempotent — reuses an existing pair when present. Not AdminAccount.
 */
export async function createProfessionalConversation(
  providerUserId: string,
): Promise<ConversationThread> {
  if (conversationsUseMock()) {
    return {
      conversationId: `demo-professional-${providerUserId}`,
      hallId: "",
      hallName: t("professionals.contact.threadFallback"),
      initiatorUserId: "",
      ownerUserId: providerUserId,
      createdAt: new Date().toISOString(),
      isExisting: true,
      contextPostId: null,
      contextOfferId: null,
    };
  }
  try {
    const { data } = await api.post<ConversationResponse>(
      `/professionals/${encodeURIComponent(providerUserId)}/conversations`,
      undefined,
      { timeout: 8000 },
    );
    const thread = mapResponse(data, "");
    if (!thread.conversationId) {
      throw new ApiError(t("errors.conversation.create"), 500);
    }
    return thread;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(t("errors.conversation.create"), 0);
  }
}

/**
 * Hall owner "Contact Admin": resolves (and creates when missing) the owner ↔ Admin thread
 * for one of the owner's halls. Idempotent on the backend.
 */
export async function contactAdminForHall(hallId: string): Promise<ConversationThread> {
  if (conversationsUseMock()) {
    return mockCreateHallConversation(hallId);
  }
  const { data } = await api.post<ConversationResponse>(
    `/halls/${encodeURIComponent(hallId)}/conversations/contact-admin`,
    undefined,
    { timeout: 8000 },
  );
  const thread = mapResponse(data, hallId);
  if (!thread.conversationId) {
    throw new ApiError(t("errors.conversation.create"), 500);
  }
  return thread;
}

/**
 * EventCoordinator / Photographer ↔ Admin account thread
 * (`POST /conversations/contact-admin-account`, ConversationKind.AdminAccount).
 * Idempotent on the backend — reuses an existing AdminAccount conversation.
 */
export async function contactAdminAccount(): Promise<ConversationThread> {
  if (conversationsUseMock()) {
    return {
      conversationId: "demo-admin-account",
      hallId: "",
      hallName: "",
      initiatorUserId: "",
      ownerUserId: "",
      createdAt: new Date().toISOString(),
      isExisting: true,
      contextPostId: null,
      contextOfferId: null,
    };
  }
  const { data } = await api.post<ConversationResponse>(
    "/conversations/contact-admin-account",
    undefined,
    { timeout: 8000 },
  );
  const thread = mapResponse(data, "");
  if (!thread.conversationId) {
    throw new ApiError(t("errors.conversation.create"), 500);
  }
  return thread;
}

/** POST /posts/{postId}/conversation — inquiry tied to a post. */
export async function startConversationFromPost(
  postId: string,
): Promise<ConversationThread> {
  const { data } = await api.post<ConversationResponse>(
    `/posts/${encodeURIComponent(postId)}/conversation`,
    undefined,
    { timeout: 8000 },
  );
  const thread = mapResponse(data);
  if (!thread.conversationId) {
    throw new ApiError(t("errors.conversation.create"), 500);
  }
  return thread;
}

/**
 * Professional ↔ Admin account thread summary (excluded from GET /conversations for non-admins).
 * Returns null when the account has never opened contact-admin-account.
 */
export async function fetchMyAdminAccountConversation(): Promise<ConversationSummary | null> {
  if (conversationsUseMock()) {
    return {
      conversationId: "demo-admin-account",
      kind: "AdminAccount",
      hallId: "",
      hallName: "",
      otherParticipantId: "admin",
      otherParticipantName: t("owner.messages.admin"),
      lastMessagePreview: "",
      lastMessageAt: null,
      messageCount: 0,
      unreadMessageCount: 0,
      createdAt: new Date().toISOString(),
      isUnread: false,
    };
  }
  try {
    const { data } = await api.get<ConversationResponse>("/conversations/admin-account", {
      timeout: 8000,
    });
    const thread = mapResponse(data, "");
    if (!thread.conversationId) return null;
    return {
      conversationId: thread.conversationId,
      kind: "AdminAccount",
      hallId: "",
      hallName: "",
      otherParticipantId: "admin",
      otherParticipantName: t("owner.messages.admin"),
      lastMessagePreview: "",
      lastMessageAt: null,
      messageCount: 0,
      unreadMessageCount: 0,
      createdAt: thread.createdAt,
      isUnread: false,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const status = error.status;
    // Missing conversation often comes back as 404/204/4xx — keep inbox usable.
    if (status === 404 || status === 204 || (status != null && status >= 400 && status < 500)) {
      return null;
    }
    throw error;
  }
}

/** POST /offers/{offerId}/conversation — inquiry tied to an offer. */
export async function startConversationFromOffer(
  offerId: string,
): Promise<ConversationThread> {
  const { data } = await api.post<ConversationResponse>(
    `/offers/${encodeURIComponent(offerId)}/conversation`,
    undefined,
    { timeout: 8000 },
  );
  const thread = mapResponse(data);
  if (!thread.conversationId) {
    throw new ApiError(t("errors.conversation.create"), 500);
  }
  return thread;
}

function mapInboxItem(data: unknown): ConversationSummary | null {
  return mapInboxItemDto(data);
}

function currentUserIsProfessional(): boolean {
  const stored = getStoredAuth()?.user;
  return isProfessionalRole(
    resolveSessionRole(null, stored?.role, stored?.accountType),
  );
}

function readUnreadCountPayload(data: unknown): number {
  const root =
    data && typeof data === "object"
      ? (data as { unreadCount?: unknown; UnreadCount?: unknown })
      : null;
  const count = root?.unreadCount ?? root?.UnreadCount;
  return typeof count === "number" ? Math.max(0, count) : 0;
}

/** Customer chats for coordinators / photographers. */
export async function fetchProfessionalConversations(): Promise<ConversationSummary[]> {
  if (conversationsUseMock()) return mockFetchInbox();
  const { data } = await api.get<unknown>("/professional/conversations", {
    params: { page: 1, pageSize: 100 },
    timeout: 8000,
  });
  return unwrapConversationList(data)
    .map(mapInboxItem)
    .filter((item): item is ConversationSummary => Boolean(item))
    .map((item) =>
      item.kind ? item : { ...item, kind: "CustomerProvider" as const },
    );
}

/** Professional ↔ admin account thread (may 404 when not created yet). */
export async function fetchAdminAccountConversation(): Promise<ConversationSummary | null> {
  if (conversationsUseMock()) return null;
  try {
    const { data } = await api.get<unknown>("/conversations/admin-account", { timeout: 8000 });
    const mapped = mapInboxItem(data);
    if (!mapped) return null;
    return { ...mapped, kind: mapped.kind ?? "AdminAccount" };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function fetchProfessionalUnreadCount(): Promise<number> {
  if (conversationsUseMock()) return mockUnreadConversationCount();
  const { data } = await api.get<unknown>("/professional/conversations/unread-count", {
    timeout: 8000,
  });
  return readUnreadCountPayload(data);
}

export async function fetchAdminAccountUnreadCount(): Promise<number> {
  if (conversationsUseMock()) return 0;
  try {
    const { data } = await api.get<unknown>("/conversations/admin-account/unread-count", {
      timeout: 8000,
    });
    return readUnreadCountPayload(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return 0;
    throw err;
  }
}

async function fetchProfessionalInboxMerged(): Promise<ConversationSummary[]> {
  const [customers, admin] = await Promise.all([
    fetchProfessionalConversations(),
    fetchAdminAccountConversation().catch(() => null),
  ]);
  const merged = admin
    ? [admin, ...customers.filter((item) => item.conversationId !== admin.conversationId)]
    : customers;
  return [...merged].sort(
    (left, right) =>
      conversationTimeValue(right.lastMessageAt ?? right.createdAt) -
      conversationTimeValue(left.lastMessageAt ?? left.createdAt),
  );
}

export async function fetchInboxConversations(): Promise<ConversationSummary[]> {
  if (conversationsUseMock()) return mockFetchInbox();
  if (currentUserIsProfessional()) {
    return fetchProfessionalInboxMerged();
  }
  const { data } = await api.get<unknown>("/conversations", { timeout: 8000 });
  return unwrapConversationList(data)
    .map(mapInboxItem)
    .filter((item): item is ConversationSummary => Boolean(item));
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
  if (conversationsUseMock()) return mockUnreadConversationCount();
  if (currentUserIsProfessional()) {
    const [professional, admin] = await Promise.all([
      fetchProfessionalUnreadCount(),
      fetchAdminAccountUnreadCount().catch(() => 0),
    ]);
    return professional + admin;
  }
  const { data } = await api.get<unknown>("/conversations/unread-count", { timeout: 8000 });
  return readUnreadCountPayload(data);
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
