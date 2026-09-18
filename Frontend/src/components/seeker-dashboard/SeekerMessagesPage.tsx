"use client";

import Link from "next/link";
import { useEffect } from "react";
import ConversationList from "@/components/messages/ConversationList";
import MessageThreadView from "@/components/messages/MessageThreadView";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { SEEKER_MESSAGES_PATH } from "@/constants/seekerDashboardNav";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import {
  conversationHallLabel,
  conversationPreviewSubtitle,
  conversationPreviewTitle,
} from "@/lib/conversation-display";

/** Messages workspace embedded in the seeker dashboard shell. */
export default function SeekerMessagesPage() {
  const t = useT();
  const lang = useUiLang();
  const {
    selectedId,
    canUseMessaging,
    currentUserId,
    inboxStatus,
    conversations,
    inboxError,
    retryInbox,
    threadStatus,
    thread,
    threadError,
    retryThread,
    draft,
    setDraft,
    sendMessage,
    retrySend,
    selectConversation,
  } = useMessagesInbox();

  useEffect(() => {
    return () => {
      selectConversation(null);
    };
  }, [selectConversation]);

  const selected = conversations.find((item) => item.conversationId === selectedId) ?? null;
  const showThread = Boolean(selectedId);
  const threadTitle = selected
    ? conversationPreviewTitle(selected, lang)
    : thread
      ? conversationHallLabel(thread, lang)
      : t("messages.title");
  const threadSubtitle = selected
    ? conversationPreviewSubtitle(selected, lang)
    : thread && conversationHallLabel(thread, lang) !== threadTitle
      ? conversationHallLabel(thread, lang)
      : null;

  return (
    <div className="seeker-messages" data-testid="seeker-messages-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("seeker.nav.messages")}</h1>
        <p className="seeker-settings-lead">{t("seeker.messages.subtitle")}</p>
      </header>

      {!canUseMessaging ? (
        <section className="seeker-settings-card" data-testid="seeker-messages-unauthorized">
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.loginRequired")}</p>
          <Link href={`/login?redirect=${encodeURIComponent(SEEKER_MESSAGES_PATH)}`} className="btn-primary mt-5">
            {t("messages.goLogin")}
          </Link>
        </section>
      ) : (
        <section
          className="seeker-messages-workspace"
          data-testid="seeker-messages-workspace"
        >
          <div
            className={`seeker-messages-list${showThread ? " seeker-messages-list--hidden-mobile" : ""}`}
          >
            <ConversationList
              status={inboxStatus}
              conversations={conversations}
              selectedId={selectedId}
              error={inboxError}
              onSelect={selectConversation}
              onRetry={retryInbox}
              variant="page"
            />
          </div>

          <div
            className={`seeker-messages-thread${showThread ? " seeker-messages-thread--open" : " seeker-messages-thread--empty"}`}
          >
            {showThread ? (
              <MessageThreadView
                status={threadStatus}
                thread={thread}
                error={threadError}
                title={threadTitle}
                subtitle={threadSubtitle}
                currentUserId={currentUserId}
                onRetryLoad={retryThread}
                onRetrySend={retrySend}
                onSend={(text) => {
                  void sendMessage(text);
                }}
                draft={draft}
                onDraftChange={setDraft}
                composerEnabled={
                  Boolean(selectedId) &&
                  threadStatus !== "loading" &&
                  threadStatus !== "error" &&
                  threadStatus !== "idle"
                }
                onBack={() => selectConversation(null)}
                conversationId={selectedId}
                variant="page"
              />
            ) : (
              <div className="seeker-messages-placeholder" data-testid="seeker-messages-placeholder">
                <p>{t("seeker.messages.pickConversation")}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
