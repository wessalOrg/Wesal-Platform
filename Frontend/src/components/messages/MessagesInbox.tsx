"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import MabroukFigure from "@/components/brand/MabroukFigure";
import AdminChatBanner from "@/components/messages/AdminChatBanner";
import ConversationList from "@/components/messages/ConversationList";
import MessagesErrorBoundary from "@/components/messages/MessagesErrorBoundary";
import MessageThreadView from "@/components/messages/MessageThreadView";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import OwnerConfirmPaymentBar from "@/components/messages/OwnerConfirmPaymentBar";
import ProductInquiryCard from "@/components/offers/ProductInquiryCard";
import ProtectedHallMessageThread from "@/components/messages/ProtectedHallMessageThread";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useAdminChat } from "@/hooks/useAdminChat";
import { useT } from "@/i18n";
import { isAdminAccountConversation } from "@/lib/admin-account-conversation";
import { findThreadContextCard } from "@/lib/conversation-mapper";
import { isOwnerAdminConversation, ownerConversationTitle } from "@/lib/owner-admin-conversation";
import {
  conversationHallLabel,
  conversationPeerRoleLabel,
  conversationPreviewSubtitle,
  conversationPreviewTitle,
} from "@/lib/conversation-display";

type MessagesInboxProps = {
  initialConversationId?: string;
};

export default function MessagesInbox({ initialConversationId }: MessagesInboxProps) {
  const t = useT();
  const lang = useUiLang();
  const promptAttach = useSearchParams().get("attach") === "1";
  const { ready, authenticated, isHallOwner, isAdmin } = useAccountAccess();
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
    sendAttachment,
    retrySend,
    selectConversation,
  } = useMessagesInbox();
  const adminChat = useAdminChat({
    conversations,
    selectedId,
    inboxStatus,
    selectConversation,
    sendMessage,
    sendAttachment,
  });

  useEffect(() => {
    if (!authenticated || !initialConversationId) return;
    selectConversation(initialConversationId);
  }, [authenticated, initialConversationId, selectConversation]);

  const selected = conversations.find((item) => item.conversationId === selectedId) ?? null;
  const showThread = Boolean(selectedId);
  const adminAccountThread = selected ? isAdminAccountConversation(selected) : false;
  const inquiryContext = findThreadContextCard(thread?.messages);
  const threadTitle = selected
    ? isHallOwner
      ? ownerConversationTitle(selected, lang, conversations)
      : adminAccountThread
        ? t("messages.adminChat.title")
        : conversationPreviewTitle(selected, lang)
    : thread
      ? conversationHallLabel(thread, lang)
      : t("messages.title");
  const threadSubtitle = selected
    ? adminAccountThread
      ? null
      : conversationPreviewSubtitle(selected, lang)
    : thread && conversationHallLabel(thread, lang) !== threadTitle
      ? conversationHallLabel(thread, lang)
      : null;
  const threadBadge = conversationPeerRoleLabel({
    viewerIsHallOwner: isHallOwner,
    viewerIsAdmin: isAdmin,
    peerIsAdmin: adminAccountThread || Boolean(selected && isOwnerAdminConversation(selected, conversations)),
  });

  if (!ready) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="messages-inbox-loading"
      />
    );
  }

  if (!authenticated || !canUseMessaging) {
    return (
      <section
        className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="messages-inbox-unauthorized"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.inboxTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("messages.loginRequired")}
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(initialConversationId ? `/messages/${initialConversationId}` : "/messages")}`}
          className="btn-primary mt-5"
        >
          {t("messages.goLogin")}
        </Link>
      </section>
    );
  }

  return (
    <MessagesErrorBoundary>
    <section
      className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid={initialConversationId ? "messages-thread" : "messages-inbox"}
    >
      <header className="border-b border-[var(--wesal-border)] px-5 py-4">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.inboxTitle")}</h1>
        <p className="mt-1 text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.inboxSubtitle")}</p>
      </header>

      <div className="seeker-messages-workspace !min-h-[min(36rem,calc(100svh-10rem))] !rounded-none !border-0 !shadow-none">
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
            <ProtectedHallMessageThread hallId={selected?.hallId ?? thread?.hallId}>
              <MessageThreadView
                status={threadStatus}
                thread={thread}
                error={threadError}
                title={threadTitle}
                subtitle={threadSubtitle}
                badge={threadBadge}
                peerDisplayName={
                  adminAccountThread ||
                  (isHallOwner && selected && isOwnerAdminConversation(selected, conversations))
                    ? t("messages.adminChat.title")
                    : null
                }
                context={
                  <>
                    {adminAccountThread ? <AdminChatBanner className="mb-2" /> : null}
                    {inquiryContext ? (
                      <ProductInquiryCard
                        context={inquiryContext}
                        variant={inquiryContext.contextPostId ? "panel" : "inline"}
                      />
                    ) : null}
                  </>
                }
                currentUserId={currentUserId}
                onRetryLoad={retryThread}
                onRetrySend={retrySend}
                onSend={(text) => {
                  void adminChat.sendWithAttachment(text);
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
                notice={
                  <>
                    {isHallOwner ? (
                      <OwnerConfirmPaymentBar
                        hallId={selected?.hallId ?? thread?.hallId}
                        requesterUserId={selected?.otherParticipantId}
                      />
                    ) : null}
                    {adminChat.errorKey ? (
                      <p role="alert" className="text-sm text-[#a86267]">
                        {t(adminChat.errorKey)}
                      </p>
                    ) : null}
                  </>
                }
                attachmentPreviewUrl={adminChat.attachmentPreviewUrl}
                attachmentName={adminChat.attachmentName}
                attachmentBusy={adminChat.attachmentBusy}
                onPickAttachment={adminChat.pickAttachment}
                onClearAttachment={adminChat.clearAttachment}
                promptAttach={promptAttach}
              />
            </ProtectedHallMessageThread>
          ) : (
            <div
              className="seeker-messages-placeholder flex flex-col items-center gap-3 px-4 text-center"
              data-testid="messages-inbox-placeholder"
            >
              <MabroukFigure
                pose="messageEmpty"
                size="md"
                rounded="2xl"
                className="!h-32 !w-36 bg-transparent sm:!h-36 sm:!w-40"
              />
              <p>{t("messages.selectConversation")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
    </MessagesErrorBoundary>
  );
}
