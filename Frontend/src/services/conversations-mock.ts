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

const INBOX: ConversationSummary[] = [
  {
    conversationId: "mock-convo-gold",
    hallId: "mock-hall-gold",
    hallName: "قاعة النخيل الذهبية",
    otherParticipantId: "owner-1",
    otherParticipantName: "صاحب قاعة النخيل",
    lastMessagePreview: formatBookingRejectionContent(
      "قاعة النخيل الذهبية",
      "2026-09-18",
      "FirstPeriod",
      "القاعة محجوزة في هذا الموعد لأن فيه حفلين متتاليين، وما نقدر نفك الفترة. نعتذر منك، وجرب تاريخ ثاني أو الفترة الثانية إذا كانت ظاهرة متاحة، وفريق القاعة يردك من هنا إذا احتجت مساعدة.",
    ),
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    messageCount: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    conversationId: "mock-convo-royal",
    hallId: "mock-hall-royal",
    hallName: "قاعة رويال",
    otherParticipantId: "owner-2",
    otherParticipantName: "صاحب قاعة رويال",
    lastMessagePreview: "أهلاً، كيف فينا نساعدك؟",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    messageCount: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

const THREADS: Record<string, MessageThread> = {
  "mock-convo-gold": {
    conversationId: "mock-convo-gold",
    hallId: "mock-hall-gold",
    hallName: "قاعة النخيل الذهبية",
    messages: [
      {
        id: "m1",
        senderUserId: DEMO_USER_ID,
        senderName: "مستخدم وصال",
        content: "مرحبا، في توفر يوم الجمعة؟",
        sentAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
        delivery: "sent",
      },
      {
        id: "m2",
        senderUserId: "owner-1",
        senderName: "صاحب قاعة النخيل",
        content: "أهلاً، نعم المساء متاح.",
        sentAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
        delivery: "sent",
      },
      {
        id: "m3",
        senderUserId: "owner-1",
        senderName: "صاحب قاعة النخيل",
        content: "تقدر تحجز مساء الجمعة إذا بدك.",
        sentAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        delivery: "sent",
      },
      {
        id: "m4-reject",
        senderUserId: "owner-1",
        senderName: "صاحب قاعة النخيل",
        content: formatBookingRejectionContent(
          "قاعة النخيل الذهبية",
          "2026-09-18",
          "FirstPeriod",
          "القاعة محجوزة في هذا الموعد لأن فيه حفلين متتاليين، وما نقدر نفك الفترة. نعتذر منك، وجرب تاريخ ثاني أو الفترة الثانية إذا كانت ظاهرة متاحة، وفريق القاعة يردك من هنا إذا احتجت مساعدة.",
        ),
        sentAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        delivery: "sent",
      },
    ],
  },
  "mock-convo-royal": {
    conversationId: "mock-convo-royal",
    hallId: "mock-hall-royal",
    hallName: "قاعة رويال",
    messages: [
      {
        id: "r1",
        senderUserId: "owner-2",
        senderName: "صاحب قاعة رويال",
        content: "أهلاً، كيف فينا نساعدك؟",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        delivery: "sent",
      },
      {
        id: "r2",
        senderUserId: DEMO_USER_ID,
        senderName: "مستخدم وصال",
        content: "بدي أعرف السعة القصوى.",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        delivery: "sent",
      },
    ],
  },
};

const sentByClientId = new Map<string, ThreadMessage>();

function touchInbox(conversationId: string, preview: string, at: string) {
  const item = INBOX.find((row) => row.conversationId === conversationId);
  if (!item) return;
  item.lastMessagePreview = preview;
  item.lastMessageAt = at;
  item.messageCount += 1;
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

export async function mockFetchConversation(conversationId: string): Promise<{
  conversationId: string;
  hallId: string;
  hallName: string;
  initiatorUserId: string;
  ownerUserId: string;
  createdAt: string;
  isExisting: boolean;
}> {
  await wait(LATENCY_MS);
  const item = INBOX.find((row) => row.conversationId === conversationId);
  const thread = THREADS[conversationId];
  if (!item || !thread) {
    throw new ApiError(t("errors.conversation.missing"), 404);
  }
  return {
    conversationId: item.conversationId,
    hallId: item.hallId,
    hallName: item.hallName,
    initiatorUserId: DEMO_USER_ID,
    ownerUserId: item.otherParticipantId,
    createdAt: item.createdAt,
    isExisting: true,
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
