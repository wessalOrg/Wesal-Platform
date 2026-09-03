export type InboxStatus = "idle" | "loading" | "empty" | "ready" | "error";

export type ThreadStatus = "idle" | "loading" | "empty" | "ready" | "error";

export type MessageDelivery = "sent" | "pending" | "failed";

export type ConversationSummary = {
  conversationId: string;
  hallId: string;
  hallName: string;
  otherParticipantId: string;
  otherParticipantName: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
};

export type ThreadMessage = {
  id: string;
  clientRequestId?: string | null;
  senderUserId: string;
  senderName: string;
  content: string;
  sentAt: string;
  delivery: MessageDelivery;
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
