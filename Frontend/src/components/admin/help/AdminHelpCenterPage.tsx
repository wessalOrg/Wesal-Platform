"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useHelpCenterTickets } from "@/hooks/useHelpCenterTickets";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import type { HelpTicket } from "@/types/help-center";

function formatRelative(iso: string, lang: "ar" | "en"): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

type HelpConversation = {
  userId: string;
  userName: string;
  /** The asker's questions, oldest first, so the thread reads top-to-bottom. */
  tickets: HelpTicket[];
  latestAt: string;
  unreadCount: number;
};

/** Groups the Admin queue by asker so each person's messages form one conversation. */
function groupConversations(tickets: HelpTicket[]): HelpConversation[] {
  const byUser = new Map<string, HelpTicket[]>();
  for (const ticket of tickets) {
    const existing = byUser.get(ticket.userId);
    if (existing) existing.push(ticket);
    else byUser.set(ticket.userId, [ticket]);
  }

  const conversations: HelpConversation[] = [];
  for (const [userId, list] of byUser) {
    const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = ordered[ordered.length - 1];
    conversations.push({
      userId,
      userName: latest.userName,
      tickets: ordered,
      latestAt: latest.createdAt,
      unreadCount: ordered.filter((ticket) => ticket.adminUnread).length,
    });
  }

  return conversations.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

export default function AdminHelpCenterPage() {
  const t = useT();
  const lang = useUiLang();
  const { tickets, ready, reply, markConversationRead } = useHelpCenterTickets("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const conversations = useMemo(() => groupConversations(tickets), [tickets]);
  const selected = conversations.find((conversation) => conversation.userId === selectedUserId) ?? null;
  const showDetails = Boolean(selected);

  // Opening a conversation clears its unread badge for every Admin (shared read state).
  const openConversation = useCallback(
    (userId: string) => {
      setSelectedUserId(userId);
      void markConversationRead(userId).catch(() => undefined);
    },
    [markConversationRead],
  );

  const closeConversation = useCallback(() => setSelectedUserId(null), []);

  return (
    <div className="seeker-messages" data-testid="admin-help-center-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("admin.help.title")}</h1>
        <p className="seeker-settings-lead">{t("admin.help.subtitle")}</p>
      </header>

      {!ready ? (
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-help-loading"
        />
      ) : conversations.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="admin-help-empty">
          <p>{t("admin.help.empty")}</p>
        </div>
      ) : (
        <section className="seeker-messages-workspace admin-messages-workspace">
          <div
            className={`seeker-messages-list admin-messages-list${
              showDetails ? " seeker-messages-list--hidden-mobile" : ""
            }`}
          >
            <ul className="space-y-2 p-2" data-testid="admin-help-list">
              {conversations.map((conversation) => (
                <li key={conversation.userId}>
                  <ConversationListItem
                    conversation={conversation}
                    selected={conversation.userId === selectedUserId}
                    timeLabel={formatRelative(conversation.latestAt, lang)}
                    unreadLabel={t("admin.help.unreadCount", {
                      count: conversation.unreadCount,
                    })}
                    questionCountLabel={t("admin.help.questionCount", {
                      count: conversation.tickets.length,
                    })}
                    onSelect={() => openConversation(conversation.userId)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`seeker-messages-thread${
              showDetails ? " seeker-messages-thread--open" : " seeker-messages-thread--empty"
            }`}
          >
            {selected ? (
              <div className="flex h-full min-h-0 flex-col" data-testid="admin-help-detail">
                <header className="flex shrink-0 items-center gap-3 border-b border-[var(--wesal-border)] px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    className="btn-outline min-h-10 px-3 text-sm md:hidden"
                    onClick={closeConversation}
                  >
                    {t("admin.help.backToList")}
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-[var(--wesal-maroon)]">
                      {selected.userName}
                    </h2>
                    <p className="truncate text-sm text-[var(--wesal-muted)]">
                      {t("admin.help.questionCount", { count: selected.tickets.length })}
                    </p>
                  </div>
                </header>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                  {selected.tickets.map((ticket) => (
                    <QuestionCard key={ticket.id} ticket={ticket} lang={lang} onReply={reply} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="seeker-messages-placeholder">{t("admin.help.selectPrompt")}</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ConversationListItem({
  conversation,
  selected,
  timeLabel,
  unreadLabel,
  questionCountLabel,
  onSelect,
}: {
  conversation: HelpConversation;
  selected: boolean;
  timeLabel: string;
  unreadLabel: string;
  questionCountLabel: string;
  onSelect: () => void;
}) {
  const latest = conversation.tickets[conversation.tickets.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-2xl px-3 py-3 text-start transition ${
        selected
          ? "bg-[var(--wesal-pink)] ring-1 ring-[var(--wesal-maroon)]/25"
          : "bg-white hover:bg-[var(--wesal-pink-soft)]"
      }`}
      data-testid={`admin-help-item-${conversation.userId}`}
      aria-current={selected ? "true" : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-bold text-[var(--wesal-text)]">{conversation.userName}</span>
        <span className="shrink-0 text-[0.7rem] text-[var(--wesal-muted)]">{timeLabel}</span>
      </span>
      <span className="line-clamp-2 text-sm leading-6 text-[var(--wesal-muted)]">
        {latest?.question}
      </span>
      <span className="mt-1 flex items-center gap-2">
        {conversation.unreadCount > 0 ? (
          <span className="inline-flex w-fit rounded-full bg-[var(--wesal-maroon)] px-2 py-0.5 text-[0.7rem] font-bold text-white">
            {unreadLabel}
          </span>
        ) : null}
        <span className="inline-flex w-fit rounded-full bg-[var(--wesal-pink)] px-2 py-0.5 text-[0.7rem] font-bold text-[var(--wesal-maroon)]">
          {questionCountLabel}
        </span>
      </span>
    </button>
  );
}

function QuestionCard({
  ticket,
  lang,
  onReply,
}: {
  ticket: HelpTicket;
  lang: "ar" | "en";
  onReply: (id: string, content: string) => Promise<HelpTicket | null>;
}) {
  const t = useT();
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError(t("admin.help.errors.emptyReply"));
      return;
    }
    setSubmitting(true);
    setReplyError(null);
    setReplySuccess(false);
    try {
      const updated = await onReply(ticket.id, trimmed);
      if (!updated) {
        setReplyError(t("admin.help.errors.replyFailed"));
        return;
      }
      setReplyText("");
      setReplySuccess(true);
    } catch {
      setReplyError(t("admin.help.errors.replyFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3" data-testid={`admin-help-question-${ticket.id}`}>
      <article className="rounded-2xl border border-[var(--wesal-border)] bg-[#faf7f4] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--wesal-muted)]">{ticket.userName}</p>
          <span className="shrink-0 text-[0.7rem] text-[var(--wesal-muted)]">
            {formatRelative(ticket.createdAt, lang)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">
          {ticket.question}
        </p>
      </article>

      {ticket.reply ? (
        <article className="rounded-2xl border border-[#c8e6c9] bg-[#e8f5e9] p-4">
          <p className="text-xs font-bold text-[#1b5e20]">{t("admin.help.existingReply")}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#1b5e20]">
            {ticket.reply}
          </p>
        </article>
      ) : null}

      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <h3 className="text-sm font-bold text-[var(--wesal-maroon)]">
          {t("admin.help.replyTitle")}
        </h3>
        <textarea
          value={replyText}
          onChange={(event) => {
            setReplySuccess(false);
            setReplyError(null);
            setReplyText(event.target.value);
          }}
          rows={4}
          placeholder={t("admin.help.replyPlaceholder")}
          className="min-h-[7rem] w-full resize-y rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-[var(--wesal-maroon)]"
          data-testid={`admin-help-reply-${ticket.id}`}
          disabled={submitting}
        />
        {replyError ? (
          <p className="text-sm text-[#b42318]" role="alert">
            {replyError}
          </p>
        ) : null}
        {replySuccess ? (
          <p className="text-sm text-[#1b5e20]" role="status">
            {t("admin.help.replySuccess")}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn-primary min-h-11 w-full sm:w-auto"
          disabled={submitting}
          aria-busy={submitting || undefined}
          data-testid={`admin-help-reply-submit-${ticket.id}`}
        >
          {submitting ? t("admin.help.replying") : t("admin.help.sendReply")}
        </button>
      </form>
    </div>
  );
}
