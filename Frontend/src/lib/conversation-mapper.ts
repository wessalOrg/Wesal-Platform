import { t } from "@/i18n";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type {
  ConversationKind,
  ConversationSummary,
  MessageContextCard,
  MessageThread,
  ThreadMessage,
} from "@/types/messages";

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function mapConversationKind(value: unknown): ConversationKind | null {
  if (typeof value === "number") {
    if (value === 0) return "HallBooking";
    if (value === 1) return "AdminAccount";
    if (value === 2) return "CustomerProvider";
    return null;
  }
  const text = asText(value).toLowerCase();
  if (text === "hallbooking" || text === "0") return "HallBooking";
  if (text === "adminaccount" || text === "1") return "AdminAccount";
  if (text === "customerprovider" || text === "2") return "CustomerProvider";
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readIso(value: unknown, fallback = ""): string {
  const text = asText(value);
  if (!text) return fallback;
  const time = Date.parse(text);
  return Number.isNaN(time) ? fallback : text;
}

export function unwrapConversationList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const root = asRecord(data);
  if (!root) return [];
  const nested = root.items ?? root.Items ?? root.conversations ?? root.Conversations;
  return Array.isArray(nested) ? nested : [];
}

function readContext(dto: Record<string, unknown>): MessageContextCard {
  return {
    contextPostId: asText(dto.contextPostId ?? dto.ContextPostId) || null,
    contextOfferId: asText(dto.contextOfferId ?? dto.ContextOfferId) || null,
    contextTitle: asText(dto.contextTitle ?? dto.ContextTitle) || null,
    contextText: asText(dto.contextText ?? dto.ContextText) || null,
    contextImageUrl:
      resolveOfferMediaUrl(asText(dto.contextImageUrl ?? dto.ContextImageUrl)) || null,
    contextOwnerUserId: asText(dto.contextOwnerUserId ?? dto.ContextOwnerUserId) || null,
    contextItemAvailable:
      dto.contextItemAvailable == null && dto.ContextItemAvailable == null
        ? null
        : Boolean(dto.contextItemAvailable ?? dto.ContextItemAvailable),
  };
}

export function mapInboxItemDto(data: unknown): ConversationSummary | null {
  const dto = asRecord(data);
  if (!dto) return null;
  const conversationId = asText(dto.conversationId ?? dto.ConversationId ?? dto.id ?? dto.Id);
  if (!conversationId) return null;
  const hallId = asText(dto.hallId ?? dto.HallId);
  const kind = mapConversationKind(dto.kind ?? dto.Kind);
  const hallNameRaw = asText(dto.hallName ?? dto.HallName);
  const unreadMessageCount =
    typeof dto.unreadMessageCount === "number"
      ? dto.unreadMessageCount
      : typeof dto.UnreadMessageCount === "number"
        ? dto.UnreadMessageCount
        : 0;
  const isUnread = Boolean(dto.isUnread ?? dto.IsUnread) || unreadMessageCount > 0;
  return {
    conversationId,
    kind,
    hallId,
    // Keep empty for hall-less AdminAccount threads so UI can label them as Wesal Admin.
    hallName:
      hallNameRaw ||
      (kind === "AdminAccount" || !hallId ? "" : t("common.hall")),
    otherParticipantId: asText(dto.otherParticipantId ?? dto.OtherParticipantId),
    otherParticipantName:
      asText(dto.otherParticipantName ?? dto.OtherParticipantName) || t("common.user"),
    otherParticipantAvatarUrl:
      resolveOfferMediaUrl(
        asText(dto.otherParticipantAvatarUrl ?? dto.OtherParticipantAvatarUrl),
      ) || null,
    lastMessagePreview: asText(dto.lastMessagePreview ?? dto.LastMessagePreview),
    lastMessageHasAttachment: Boolean(
      dto.lastMessageHasAttachment ?? dto.LastMessageHasAttachment,
    ),
    lastMessageAt: readIso(dto.lastMessageAt ?? dto.LastMessageAt) || null,
    messageCount:
      typeof dto.messageCount === "number"
        ? dto.messageCount
        : typeof dto.MessageCount === "number"
          ? dto.MessageCount
          : 0,
    unreadMessageCount: Math.max(0, unreadMessageCount),
    createdAt: readIso(dto.createdAt ?? dto.CreatedAt, new Date().toISOString()),
    isUnread,
  };
}

/** First post/offer context card found in a thread (inquiry preview). */
export function findThreadContextCard(
  messages: ThreadMessage[] | null | undefined,
): MessageContextCard | null {
  if (!messages?.length) return null;
  for (const message of messages) {
    if (message.contextPostId || message.contextOfferId || message.contextTitle) {
      return {
        contextPostId: message.contextPostId ?? null,
        contextOfferId: message.contextOfferId ?? null,
        contextTitle: message.contextTitle ?? null,
        contextText: message.contextText ?? null,
        contextImageUrl: message.contextImageUrl ?? null,
        contextOwnerUserId: message.contextOwnerUserId ?? null,
        contextItemAvailable: message.contextItemAvailable ?? null,
      };
    }
  }
  return null;
}

function readAttachment(dto: Record<string, unknown>): {
  hasAttachment: boolean;
  attachmentUrl: string | null;
  attachmentFileName: string | null;
} {
  const hasAttachment = Boolean(dto.hasAttachment ?? dto.HasAttachment);
  const attachmentUrl = asText(dto.attachmentUrl ?? dto.AttachmentUrl) || null;
  const attachmentFileName =
    asText(dto.attachmentFileName ?? dto.AttachmentFileName) || null;
  return { hasAttachment, attachmentUrl, attachmentFileName };
}

export function mapThreadMessageDto(data: unknown): ThreadMessage | null {
  const dto = asRecord(data);
  if (!dto) return null;
  const id = asText(dto.id ?? dto.Id ?? dto.messageId ?? dto.MessageId);
  const content = asText(dto.content ?? dto.Content);
  const attachment = readAttachment(dto);
  const context = readContext(dto);
  const hasContext = Boolean(context.contextPostId || context.contextOfferId || context.contextTitle);
  if (!id || (!content && !attachment.hasAttachment && !hasContext)) return null;
  return {
    id,
    senderUserId: asText(dto.senderUserId ?? dto.SenderUserId),
    senderName: asText(dto.senderName ?? dto.SenderName) || t("common.user"),
    content,
    sentAt: readIso(dto.sentAt ?? dto.SentAt, new Date().toISOString()),
    delivery: "sent",
    hasAttachment: attachment.hasAttachment,
    attachmentUrl: attachment.attachmentUrl,
    attachmentFileName: attachment.attachmentFileName,
    ...context,
  };
}

export function mapThreadDto(data: unknown, fallbackConversationId: string): MessageThread {
  const dto = asRecord(data) ?? {};
  const messagesRaw = dto.messages ?? dto.Messages;
  const messages = Array.isArray(messagesRaw)
    ? messagesRaw
        .map(mapThreadMessageDto)
        .filter((item): item is ThreadMessage => Boolean(item))
    : [];
  const hallId = asText(dto.hallId ?? dto.HallId);
  const hallNameRaw = asText(dto.hallName ?? dto.HallName);
  return {
    conversationId:
      asText(dto.conversationId ?? dto.ConversationId) || fallbackConversationId,
    hallId,
    hallName: hallNameRaw || (hallId ? t("common.hall") : ""),
    messages,
  };
}

export function mapSendMessageDto(
  data: unknown,
  fallbackContent: string,
  clientRequestId: string,
): ThreadMessage | null {
  const dto = asRecord(data) ?? {};
  const id = asText(dto.messageId ?? dto.MessageId ?? dto.id ?? dto.Id);
  if (!id) return null;
  const attachment = readAttachment(dto);
  const context = readContext(dto);
  return {
    id,
    clientRequestId,
    senderUserId: asText(dto.senderUserId ?? dto.SenderUserId),
    senderName: asText(dto.senderName ?? dto.SenderName) || t("common.user"),
    content: asText(dto.content ?? dto.Content) || fallbackContent,
    sentAt: readIso(dto.sentAt ?? dto.SentAt, new Date().toISOString()),
    delivery: "sent",
    hasAttachment: attachment.hasAttachment,
    attachmentUrl: attachment.attachmentUrl,
    attachmentFileName: attachment.attachmentFileName,
    ...context,
  };
}

export function mapRealtimeMessageDto(data: unknown): {
  conversationId: string;
  message: ThreadMessage;
  unreadMessageCount?: number;
  totalUnreadCount?: number;
} | null {
  const dto = asRecord(data);
  if (!dto) return null;
  const conversationId = asText(dto.conversationId ?? dto.ConversationId);
  const message = mapThreadMessageDto({
    ...dto,
    id: dto.messageId ?? dto.MessageId ?? dto.id ?? dto.Id,
  });
  if (!conversationId || !message) return null;
  const unreadMessageCount =
    typeof dto.unreadMessageCount === "number"
      ? dto.unreadMessageCount
      : typeof dto.UnreadMessageCount === "number"
        ? dto.UnreadMessageCount
        : undefined;
  const totalUnreadCount =
    typeof dto.totalUnreadCount === "number"
      ? dto.totalUnreadCount
      : typeof dto.TotalUnreadCount === "number"
        ? dto.TotalUnreadCount
        : undefined;
  return { conversationId, message, unreadMessageCount, totalUnreadCount };
}

export function conversationTimeValue(iso: string | null | undefined): number {
  if (!iso) return 0;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}
