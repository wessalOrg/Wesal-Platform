import type { WesalRole } from "@/types/session";

export type UserRole = Extract<WesalRole, "RegisteredUser" | "HallOwner" | "Admin">;

export type Sender = {
  senderUserId: string;
  senderName: string;
};

export type InboxStatus = "idle" | "loading" | "empty" | "ready" | "error";

export type ThreadStatus = "idle" | "loading" | "empty" | "ready" | "error";

export type MessageDelivery = "sent" | "pending" | "failed";

/** Derived from message content — chat API is text-only. */
export type ChatMessageKind = "TEXT" | "IMAGE";

export type ConversationSummary = {
  conversationId: string;
  hallId: string;
  hallName: string;
  otherParticipantId: string;
  otherParticipantName: string;
  lastMessagePreview: string;
  lastMessageHasAttachment?: boolean;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  isUnread: boolean;
};

export type ThreadMessage = {
  id: string;
  clientRequestId?: string | null;
  senderUserId: string;
  senderName: string;
  content: string;
  sentAt: string;
  delivery: MessageDelivery;
  hasAttachment?: boolean;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  localPreviewUrl?: string | null;
};

export type MessageThread = {
  conversationId: string;
  hallId: string;
  hallName: string;
  messages: ThreadMessage[];
};

export type IncomingRealtimeMessage = {
  conversationId: string;
  message: ThreadMessage;
};

export type Conversation = ConversationSummary;
export type Message = ThreadMessage;
