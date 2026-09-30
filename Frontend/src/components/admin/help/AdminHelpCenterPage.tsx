"use client";

import { useCallback, useState, type FormEvent } from "react";
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

export default function AdminHelpCenterPage() {
  const t = useT();
  const lang = useUiLang();
  const { tickets, ready, reply } = useHelpCenterTickets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const showDetails = Boolean(selected);

  // Event-driven reset (not an effect): the reply form belongs to one ticket at a time.
  const selectTicket = useCallback((id: string | null) => {
    setSelectedId(id);
    setReplyText("");
    setReplyError(null);
    setReplySuccess(false);
  }, []);

  const onReply = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError(t("admin.help.errors.emptyReply"));
      return;
    }
    setSubmitting(true);
    setReplyError(null);
    setReplySuccess(false);
    try {
      const updated = reply(selected.id, trimmed);
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
      ) : tickets.length === 0 ? (
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
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <QuestionListItem
                    ticket={ticket}
                    selected={ticket.id === selectedId}
                    timeLabel={formatRelative(ticket.createdAt, lang)}
                    onSelect={() => selectTicket(ticket.id)}
                    statusLabel={
                      ticket.status === "replied"
                        ? t("admin.help.status.replied")
                        : t("admin.help.status.new")
                    }
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
                    onClick={() => selectTicket(null)}
                  >
                    {t("admin.help.backToList")}
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-[var(--wesal-maroon)]">
                      {t("admin.help.detailTitle")}
                    </h2>
                    <p className="truncate text-sm text-[var(--wesal-muted)]">
                      {selected.userName} · {formatRelative(selected.createdAt, lang)}
                    </p>
                  </div>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <article className="rounded-2xl border border-[var(--wesal-border)] bg-[#faf7f4] p-4">
                    <p className="text-xs font-bold text-[var(--wesal-muted)]">
                      {selected.userName}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">
                      {selected.question}
                    </p>
                  </article>

                  {selected.reply ? (
                    <article className="rounded-2xl border border-[#c8e6c9] bg-[#e8f5e9] p-4">
                      <p className="text-xs font-bold text-[#1b5e20]">
                        {t("admin.help.existingReply")}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#1b5e20]">
                        {selected.reply}
                      </p>
                    </article>
                  ) : null}

                  <form className="space-y-3" onSubmit={onReply}>
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
                      rows={5}
                      placeholder={t("admin.help.replyPlaceholder")}
                      className="min-h-[8rem] w-full resize-y rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-[var(--wesal-maroon)]"
                      data-testid="admin-help-reply"
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
                      data-testid="admin-help-reply-submit"
                    >
                      {submitting ? t("admin.help.replying") : t("admin.help.sendReply")}
                    </button>
                  </form>
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

function QuestionListItem({
  ticket,
  selected,
  timeLabel,
  statusLabel,
  onSelect,
}: {
  ticket: HelpTicket;
  selected: boolean;
  timeLabel: string;
  statusLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-2xl px-3 py-3 text-start transition ${
        selected
          ? "bg-[var(--wesal-pink)] ring-1 ring-[var(--wesal-maroon)]/25"
          : "bg-white hover:bg-[var(--wesal-pink-soft)]"
      }`}
      data-testid={`admin-help-item-${ticket.id}`}
      aria-current={selected ? "true" : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-bold text-[var(--wesal-text)]">{ticket.userName}</span>
        <span className="shrink-0 text-[0.7rem] text-[var(--wesal-muted)]">{timeLabel}</span>
      </span>
      <span className="line-clamp-2 text-sm leading-6 text-[var(--wesal-muted)]">
        {ticket.question}
      </span>
      <span
        className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${
          ticket.status === "replied"
            ? "bg-[#e8f5e9] text-[#1b5e20]"
            : "bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"
        }`}
      >
        {statusLabel}
      </span>
    </button>
  );
}
