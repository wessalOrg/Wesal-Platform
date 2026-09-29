"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ConversationList from "@/components/messages/ConversationList";
import MessagesErrorBoundary from "@/components/messages/MessagesErrorBoundary";
import MessageThreadView from "@/components/messages/MessageThreadView";
import OwnerConfirmPaymentBar from "@/components/messages/OwnerConfirmPaymentBar";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import ProtectedHallMessageThread from "@/components/messages/ProtectedHallMessageThread";
import { SEEKER_MESSAGES_PATH } from "@/constants/seekerDashboardNav";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAdminChat } from "@/hooks/useAdminChat";
import { useT } from "@/i18n";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import {
  conversationHallLabel,
  conversationPeerRoleLabel,
  conversationPreviewSubtitle,
  conversationPreviewTitle,
} from "@/lib/conversation-display";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";

/** Messages workspace embedded in the seeker dashboard shell. */
export default function SeekerMessagesPage() {
  const t = useT();
  const lang = useUiLang();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isHallOwner, isAdmin } = useAccountAccess();
  const focusHallId = searchParams.get("hallId")?.trim() || null;
  const focusConversationId = searchParams.get("conversation_id")?.trim() || null;
  const ownerContactAdmin =
    pathname.startsWith("/owner/messages") && searchParams.get("contact") === "admin";
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
    focusHallId: isHallOwner ? focusHallId : null,
    focusConversationId,
    focusAdmin: ownerContactAdmin,
  });

  useEffect(() => {
    if (!focusConversationId || ownerContactAdmin) return;
    if (selectedId === focusConversationId) return;
    selectConversation(focusConversationId);
  }, [focusConversationId, ownerContactAdmin, selectedId, selectConversation]);

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
  const threadBadge = conversationPeerRoleLabel({
    viewerIsHallOwner: isHallOwner,
    viewerIsAdmin: isAdmin,
    peerIsAdmin: selected
      ? isOwnerAdminConversation(selected, conversations)
      : ownerContactAdmin,
  });

  return (
    <MessagesErrorBoundary>
    <div className="seeker-messages" data-testid="seeker-messages-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">
          {ownerContactAdmin ? t("owner.nav.contactAdmin") : t("seeker.nav.messages")}
        </h1>
        {ownerContactAdmin ? null : (
          <p className="seeker-settings-lead">{t("seeker.messages.subtitle")}</p>
        )}
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
              <ProtectedHallMessageThread hallId={selected?.hallId ?? thread?.hallId}>
              <MessageThreadView
                status={threadStatus}
                thread={thread}
                error={threadError}
                title={threadTitle}
                subtitle={threadSubtitle}
                badge={showThread ? threadBadge : null}
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
                      <p role="alert" className="seeker-settings-alert text-sm">
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
              />
              </ProtectedHallMessageThread>
            ) : adminChat.missingConversation ? (
              <div
                className="seeker-messages-placeholder px-4"
                data-testid="owner-admin-conversation-missing"
              >
                <p>{t("messages.noAdminConversation")}</p>
              </div>
            ) : (
              <div className="seeker-messages-placeholder" data-testid="seeker-messages-placeholder">
                <p>{t("seeker.messages.pickConversation")}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
    </MessagesErrorBoundary>
  );
}
