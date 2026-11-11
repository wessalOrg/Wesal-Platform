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

/** Mirrors backend ConversationKind (string or numeric from API). */
export type ConversationKind = "HallBooking" | "AdminAccount" | "CustomerProvider" | string;

export type MessageContextCard = {
  contextPostId: string | null;
  contextOfferId: string | null;
  contextTitle: string | null;
  contextText: string | null;
  contextImageUrl: string | null;
  contextOwnerUserId: string | null;
  contextItemAvailable: boolean | null;
};

export type ConversationSummary = {
  conversationId: string;
  /** Present when inbox payload includes ConversationKind (AdminAccount, etc.). */
  kind?: ConversationKind | null;
  hallId: string;
  hallName: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantAvatarUrl?: string | null;
  lastMessagePreview: string;
  lastMessageHasAttachment?: boolean;
  lastMessageAt: string | null;
  messageCount: number;
  /** Per-conversation unread count from API (`UnreadMessageCount`). */
  unreadMessageCount: number;
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
} & Partial<MessageContextCard>;

export type MessageThread = {
  conversationId: string;
  hallId: string;
  hallName: string;
  messages: ThreadMessage[];
};

export type IncomingRealtimeMessage = {
  conversationId: string;
  message: ThreadMessage;
  unreadMessageCount?: number;
  totalUnreadCount?: number;
};

export type Conversation = ConversationSummary;
export type Message = ThreadMessage;
