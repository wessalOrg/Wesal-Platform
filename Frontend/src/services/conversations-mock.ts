import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";
import { formatBookingRejectionContent } from "@/lib/booking-rejection-message";
import type { ConversationSummary, MessageThread, ThreadMessage } from "@/types/messages";

export const DEMO_USER_ID = "demo-user";

const LATENCY_MS = 320;

type IncomingHandler = (payload: { conversationId: string; message: ThreadMessage }) => void;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const listeners = new Set<IncomingHandler>();

export function subscribeMockMessages(handler: IncomingHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function emitMock(conversationId: string, message: ThreadMessage) {
  listeners.forEach((handler) => handler({ conversationId, message }));
}

const deferredRejectionOnce = new Set<string>();

function scheduleMockDeferredRejection(conversationId: string) {
  if (conversationId !== "mock-convo-royal") return;
  if (deferredRejectionOnce.has(conversationId)) return;
  deferredRejectionOnce.add(conversationId);
  window.setTimeout(() => {
    const live = THREADS[conversationId];
    const item = INBOX.find((row) => row.conversationId === conversationId);
    if (!live || live.messages.some((row) => row.id === "r-reject-deferred")) return;
    const sentAt = new Date().toISOString();
    const message: ThreadMessage = {
      id: "r-reject-deferred",
      senderUserId: item?.otherParticipantId ?? "owner-2",
      senderName: item?.otherParticipantName ?? t("common.user"),
      content: formatBookingRejectionContent(
        "قاعة رويال",
        "2026-10-02",
        "SecondPeriod",
        "نعتذر، القاعة محجوزة بالكامل في هذا الموعد لأن فيه حفلين متتاليين وما نقدر نفك أي فترة. جرب تاريخ ثاني أو الفترة الأولى إذا كانت ظاهرة متاحة في التقويم، وفريقنا يرد عليك من هنا إذا احتجت مساعدة باختيار يوم بديل يناسب عدد الضيوف.",
      ),
      sentAt,
      delivery: "sent",
    };
    live.messages = [...live.messages, message];
    touchInbox(conversationId, message.content, sentAt);
    emitMock(conversationId, message);
  }, 2200);
}

const INBOX: ConversationSummary[] = [];

const THREADS: Record<string, MessageThread> = {};

const sentByClientId = new Map<string, ThreadMessage>();

function touchInbox(
  conversationId: string,
  preview: string,
  at: string,
  hasAttachment = false,
) {
  const item = INBOX.find((row) => row.conversationId === conversationId);
  if (!item) return;
  item.lastMessagePreview = preview;
  item.lastMessageHasAttachment = hasAttachment;
  item.lastMessageAt = at;
  item.messageCount += 1;
  item.isUnread = true;
}

export function mockUnreadConversationCount(): number {
  return INBOX.filter((item) => item.isUnread).length;
}

export async function mockFetchInbox(): Promise<ConversationSummary[]> {
  await wait(LATENCY_MS);
  return INBOX.map((item) => ({ ...item }));
}

export async function mockFetchThread(conversationId: string): Promise<MessageThread> {
  await wait(LATENCY_MS);
  const thread = THREADS[conversationId];
  if (!thread) {
    throw new ApiError(t("errors.conversation.missing"), 404);
  }
  scheduleMockDeferredRejection(conversationId);
  return {
    ...thread,
    messages: thread.messages.map((message) => ({ ...message })),
  };
}

export async function mockSendMessage(
  conversationId: string,
  content: string,
  clientRequestId: string,
): Promise<ThreadMessage> {
  await wait(LATENCY_MS);
  const existing = sentByClientId.get(clientRequestId);
  if (existing) return { ...existing };

  const thread = THREADS[conversationId];
  if (!thread) {
    throw new ApiError(t("errors.conversation.missing"), 404);
  }

  const sentAt = new Date().toISOString();
  const message: ThreadMessage = {
    id: `mock-msg-${clientRequestId}`,
    clientRequestId,
    senderUserId: DEMO_USER_ID,
    senderName: t("auth.stub.demoUser"),
    content,
    sentAt,
    delivery: "sent",
  };
  thread.messages = [...thread.messages, message];
  sentByClientId.set(clientRequestId, message);
  touchInbox(conversationId, content, sentAt);
  emitMock(conversationId, message);

  const item = INBOX.find((row) => row.conversationId === conversationId);
  window.setTimeout(() => {
    const replyAt = new Date().toISOString();
    const reply: ThreadMessage = {
      id: `mock-reply-${clientRequestId}`,
      senderUserId: item?.otherParticipantId ?? "owner-1",
      senderName: item?.otherParticipantName ?? t("common.user"),
      content: t("messages.mockReply"),
      sentAt: replyAt,
      delivery: "sent",
    };
    const live = THREADS[conversationId];
    if (!live) return;
    live.messages = [...live.messages, reply];
    touchInbox(conversationId, reply.content, replyAt);
    emitMock(conversationId, reply);
  }, 900);

  return { ...message };
}

export async function mockSendAttachment(
  conversationId: string,
  file: File,
  content: string,
  clientRequestId: string,
): Promise<ThreadMessage> {
  await wait(LATENCY_MS);
  const existing = sentByClientId.get(clientRequestId);
  if (existing) return { ...existing };

  const thread = THREADS[conversationId];
  if (!thread) {
    throw new ApiError(t("errors.conversation.missing"), 404);
  }

  const sentAt = new Date().toISOString();
  const message: ThreadMessage = {
    id: `mock-msg-${clientRequestId}`,
    clientRequestId,
    senderUserId: DEMO_USER_ID,
    senderName: t("auth.stub.demoUser"),
    content,
    sentAt,
    delivery: "sent",
    hasAttachment: true,
    attachmentFileName: file.name,
    localPreviewUrl: URL.createObjectURL(file),
  };
  thread.messages = [...thread.messages, message];
  sentByClientId.set(clientRequestId, message);
  touchInbox(conversationId, content, sentAt, true);
  emitMock(conversationId, message);
  return { ...message };
}

export async function mockCreateHallConversation(hallId: string): Promise<{
  conversationId: string;
  hallId: string;
  hallName: string;
  initiatorUserId: string;
  ownerUserId: string;
  createdAt: string;
  isExisting: boolean;
}> {
  await wait(LATENCY_MS);
  const existing = INBOX.find((row) => row.hallId === hallId);
  if (existing && THREADS[existing.conversationId]) {
    return {
      conversationId: existing.conversationId,
      hallId: existing.hallId,
      hallName: existing.hallName,
      initiatorUserId: DEMO_USER_ID,
      ownerUserId: existing.otherParticipantId,
      createdAt: existing.createdAt,
      isExisting: true,
    };
  }

  const conversationId = `mock-convo-${hallId}`;
  const hallName = t("common.hall");
  const createdAt = new Date().toISOString();
  if (!INBOX.some((row) => row.conversationId === conversationId)) {
    INBOX.unshift({
      conversationId,
      hallId,
      hallName,
      otherParticipantId: `owner-${hallId}`,
      otherParticipantName: hallName,
      lastMessagePreview: "",
      lastMessageAt: null,
      messageCount: 0,
      createdAt,
      isUnread: false,
    });
  }
  if (!THREADS[conversationId]) {
    THREADS[conversationId] = {
      conversationId,
      hallId,
      hallName,
      messages: [],
    };
  }
  return {
    conversationId,
    hallId,
    hallName,
    initiatorUserId: DEMO_USER_ID,
    ownerUserId: `owner-${hallId}`,
    createdAt,
    isExisting: false,
  };
}

export async function mockMarkConversationAsRead(conversationId: string): Promise<void> {
  const item = INBOX.find((row) => row.conversationId === conversationId);
  if (item) item.isUnread = false;
}
