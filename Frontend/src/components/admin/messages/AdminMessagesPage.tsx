"use client";

import AdminMessageFilters from "@/components/admin/messages/AdminMessageFilters";
import AdminMessageList from "@/components/admin/messages/AdminMessageList";
import AdminMessageSearch from "@/components/admin/messages/AdminMessageSearch";
import AdminMessageThreadView from "@/components/admin/messages/AdminMessageThreadView";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAdminMessages } from "@/hooks/useAdminMessages";
import { useT } from "@/i18n";
import { localizeHallName } from "@/lib/localize-hall-display";

export default function AdminMessagesPage() {
  const t = useT();
  const lang = useUiLang();
  const state = useAdminMessages();

  const showThread = Boolean(state.selectedItem);
  const title = state.selectedItem
    ? localizeHallName(
        state.selectedItem.hallId,
        state.selectedItem.hallName,
        lang,
      ).trim() ||
      state.selectedItem.ownerName ||
      t("admin.messages.title")
    : t("admin.messages.title");
  const subtitle = state.selectedItem?.ownerName.trim()
    ? t("admin.messages.ownerLabel", { name: state.selectedItem.ownerName.trim() })
    : null;

  return (
    <div className="admin-messages seeker-messages" data-testid="admin-messages-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("admin.messages.title")}</h1>
        <p className="seeker-settings-lead">{t("admin.messages.subtitle")}</p>
      </header>

      <section
        className="seeker-messages-workspace admin-messages-workspace"
        data-testid="admin-messages-workspace"
      >
        <div
          className={`seeker-messages-list admin-messages-list${showThread ? " seeker-messages-list--hidden-mobile" : ""}`}
        >
          <div className="shrink-0 space-y-3 border-b border-[var(--wesal-border)] bg-white p-3">
            <AdminMessageFilters
              value={state.filter}
              counts={state.counts}
              onChange={state.setFilter}
            />
            <AdminMessageSearch
              value={state.searchQuery}
              onChange={state.setSearchQuery}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f4f1] p-2">
            <AdminMessageList
              status={state.listStatus}
              items={state.items}
              selectedId={state.selectedId}
              error={state.inboxError}
              emptyReason={state.emptyReason}
              onSelect={state.selectItem}
              onRetry={state.retryInbox}
            />
          </div>
        </div>

        <div
          className={`seeker-messages-thread${showThread ? " seeker-messages-thread--open" : " seeker-messages-thread--empty"}`}
        >
          {showThread && state.selectedItem ? (
            <AdminMessageThreadView
              status={state.threadStatus}
              thread={state.thread}
              error={state.threadError}
              title={title}
              subtitle={subtitle}
              category={state.selectedItem.category}
              currentUserId={state.currentUserId}
              onRetryLoad={state.retryThread}
              onRetrySend={state.retrySend}
              onSend={(text) => {
                void state.sendMessage(text);
              }}
              draft={state.draft}
              onDraftChange={state.setDraft}
              composerEnabled={
                state.threadStatus !== "loading" &&
                state.threadStatus !== "error" &&
                state.threadStatus !== "idle"
              }
              onBack={() => state.selectItem(null)}
              conversationId={
                state.thread?.conversationId || state.selectedItem.conversationId
              }
            />
          ) : (
            <div
              className="seeker-messages-placeholder"
              data-testid="admin-messages-placeholder"
            >
              <p>{t("admin.messages.pickConversation")}</p>
            </div>
          )}
        </div>
      </section>

      {state.deliveryPending ? (
        <p
          className="mt-3 text-xs text-[var(--wesal-muted)]"
          data-testid="admin-messages-delivery-pending"
        >
          {t("admin.halls.message.deliveryPending")}
        </p>
      ) : null}
    </div>
  );
}
