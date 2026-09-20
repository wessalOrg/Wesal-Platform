"use client";

import { useEffect } from "react";
import Link from "next/link";
import MessageThreadView from "@/components/messages/MessageThreadView";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import ProtectedHallMessageThread from "@/components/messages/ProtectedHallMessageThread";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useT } from "@/i18n";
import { conversationHallLabel } from "@/lib/conversation-display";

type MessagesViewProps = {
  conversationId: string;
};

export default function MessagesView({ conversationId }: MessagesViewProps) {
  const t = useT();
  const lang = useUiLang();
  const { ready, authenticated } = useAccountAccess();
  const {
    selectConversation,
    threadStatus,
    thread,
    threadError,
    retryThread,
    currentUserId,
    draft,
    setDraft,
    sendMessage,
    retrySend,
    conversations,
  } = useMessagesInbox();
  const selectedConversation =
    conversations.find((item) => item.conversationId === conversationId) ?? null;

  useEffect(() => {
    if (!authenticated) return;
    selectConversation(conversationId);
  }, [authenticated, conversationId, selectConversation]);

  if (!ready) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="messages-loading"
      />
    );
  }

  if (!authenticated) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]" data-testid="messages-unauthorized">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.title")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("messages.loginRequired")}
        </p>
        <Link href={`/login?redirect=/messages/${conversationId}`} className="btn-primary mt-5">
          {t("messages.goLogin")}
        </Link>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-[min(36rem,calc(100svh-8rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid="messages-thread"
    >
      <ProtectedHallMessageThread hallId={selectedConversation?.hallId ?? thread?.hallId}>
      <MessageThreadView
        status={threadStatus}
        thread={thread}
        error={threadError}
        title={thread ? conversationHallLabel(thread, lang) : t("messages.title")}
        currentUserId={currentUserId}
        onRetryLoad={retryThread}
        onRetrySend={retrySend}
        onSend={(text) => {
          void sendMessage(text);
        }}
        draft={draft}
        onDraftChange={setDraft}
        composerEnabled={threadStatus !== "loading" && threadStatus !== "error"}
        composerId="message-draft"
        conversationId={conversationId}
      />
      </ProtectedHallMessageThread>
    </section>
  );
}
