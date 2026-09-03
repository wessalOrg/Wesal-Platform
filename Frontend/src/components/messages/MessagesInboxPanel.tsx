"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConversationList from "@/components/messages/ConversationList";
import MessageThreadView from "@/components/messages/MessageThreadView";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useT } from "@/i18n";
import { conversationPreviewSubtitle, conversationPreviewTitle } from "@/lib/conversation-display";

export default function MessagesInboxPanel() {
  const t = useT();
  const {
    isOpen,
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
    closeInbox,
    selectConversation,
  } = useMessagesInbox();
  const [expanded, setExpanded] = useState(false);
  const selected = conversations.find((item) => item.conversationId === selectedId) ?? null;
  const showThread = Boolean(selectedId);

  useEffect(() => {
    if (isOpen) return;
    setExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (expanded) {
        setExpanded(false);
        return;
      }
      closeInbox();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, expanded, closeInbox]);

  if (!isOpen) return null;

  const threadTitle = selected
    ? conversationPreviewTitle(selected)
    : thread?.hallName || t("messages.title");
  const threadSubtitle = selected
    ? conversationPreviewSubtitle(selected)
    : thread?.hallName && thread.hallName !== threadTitle
      ? thread.hallName
      : null;

  const iconBtnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wesal-maroon)]/45 bg-white text-[var(--wesal-maroon)] shadow-[0_4px_12px_rgba(193,123,127,0.16)] transition hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white";

  return (
    <div
      className="fixed inset-0 z-[106]"
      role="presentation"
      data-testid="messages-inbox-overlay"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label={t("common.close")}
        onClick={closeInbox}
      />
      <div
        id="messages-inbox-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="messages-inbox-title"
        data-inbox-size={expanded ? "expanded" : "compact"}
        className={
          expanded
            ? "absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 flex h-[min(38rem,calc(100svh-5.5rem))] w-[min(46rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[var(--wesal-pink)] shadow-[0_18px_44px_rgba(90,55,45,0.22)] sm:left-4"
            : "absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 flex h-[min(30rem,calc(100svh-6.5rem))] w-[min(21.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[var(--wesal-pink)] shadow-[0_18px_44px_rgba(90,55,45,0.22)] sm:left-4 sm:w-[22rem]"
        }
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--wesal-maroon)]/15 px-3 py-2.5">
          <h2 id="messages-inbox-title" className="text-base font-bold text-[var(--wesal-maroon)]">
            {t("messages.inboxTitle")}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={iconBtnClass}
              aria-label={expanded ? t("messages.collapseInbox") : t("messages.expandInbox")}
              aria-pressed={expanded}
              data-testid="messages-inbox-expand"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <button
              type="button"
              className={iconBtnClass}
              aria-label={t("messages.closeInbox")}
              onClick={closeInbox}
            >
              ✕
            </button>
          </div>
        </div>

        {!canUseMessaging ? (
          <div className="px-4 py-6" data-testid="inbox-unauthorized">
            <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.loginInbox")}</p>
            <Link href="/login" className="btn-primary mt-4 inline-flex" onClick={closeInbox}>
              {t("messages.goLogin")}
            </Link>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1">
            <div
              className={`min-h-0 overflow-y-auto ${
                expanded
                  ? `w-full shrink-0 sm:w-64 sm:border-e sm:border-[var(--wesal-maroon)]/15 ${showThread ? "hidden sm:block" : "block"}`
                  : `w-full ${showThread ? "hidden" : "block"}`
              }`}
            >
              <ConversationList
                status={inboxStatus}
                conversations={conversations}
                selectedId={selectedId}
                error={inboxError}
                onSelect={selectConversation}
                onRetry={retryInbox}
                variant="widget"
              />
            </div>
            <div
              className={`min-h-0 min-w-0 flex-1 ${
                expanded ? (showThread ? "flex" : "hidden sm:flex") : showThread ? "flex" : "hidden"
              }`}
            >
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
                variant="widget"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M9 5H5v4M15 5h4v4M5 15v4h4M19 15v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M15 9h4V5M9 9H5V5M5 15v4h4M19 15v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
