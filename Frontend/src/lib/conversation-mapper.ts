import { t } from "@/i18n";
import type { ConversationSummary, MessageThread, ThreadMessage } from "@/types/messages";

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
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

export function mapInboxItemDto(data: unknown): ConversationSummary | null {
  const dto = asRecord(data);
  if (!dto) return null;
  const conversationId = asText(dto.conversationId ?? dto.ConversationId ?? dto.id ?? dto.Id);
  if (!conversationId) return null;
  return {
    conversationId,
    hallId: asText(dto.hallId ?? dto.HallId),
    hallName: asText(dto.hallName ?? dto.HallName) || t("common.hall"),
    otherParticipantId: asText(dto.otherParticipantId ?? dto.OtherParticipantId),
    otherParticipantName:
      asText(dto.otherParticipantName ?? dto.OtherParticipantName) || t("common.user"),
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
    createdAt: readIso(dto.createdAt ?? dto.CreatedAt, new Date().toISOString()),
    isUnread: Boolean(dto.isUnread ?? dto.IsUnread),
  };
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
  if (!id || (!content && !attachment.hasAttachment)) return null;
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
  return {
    conversationId:
      asText(dto.conversationId ?? dto.ConversationId) || fallbackConversationId,
    hallId: asText(dto.hallId ?? dto.HallId),
    hallName: asText(dto.hallName ?? dto.HallName) || t("common.hall"),
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
  };
}

export function mapRealtimeMessageDto(data: unknown): {
  conversationId: string;
  message: ThreadMessage;
} | null {
  const dto = asRecord(data);
  if (!dto) return null;
  const conversationId = asText(dto.conversationId ?? dto.ConversationId);
  const message = mapThreadMessageDto({
    ...dto,
    id: dto.messageId ?? dto.MessageId ?? dto.id ?? dto.Id,
  });
  if (!conversationId || !message) return null;
  return { conversationId, message };
}

export function conversationTimeValue(iso: string | null | undefined): number {
  if (!iso) return 0;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}
