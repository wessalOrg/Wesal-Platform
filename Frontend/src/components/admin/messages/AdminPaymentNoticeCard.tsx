"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

type AdminPaymentNoticeCardProps = {
  title: string;
  body: string;
  sentAt: string;
};

function formatClock(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AdminPaymentNoticeCard({
  title,
  body,
  sentAt,
}: AdminPaymentNoticeCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const clock = formatClock(sentAt, locale);

  return (
    <article
      className="ms-auto w-full max-w-[28rem] rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[#f8e9ea] px-3.5 py-3 shadow-[0_6px_16px_rgba(90,55,45,0.06)]"
      data-testid="admin-payment-notice-card"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--wesal-maroon-dark)]"
          aria-hidden="true"
        >
          <CalendarIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-6 text-[var(--wesal-maroon-dark)]">
            {title || t("admin.messages.paymentNotice.cardTitle")}
          </h3>
          <p className="mt-1 text-xs leading-6 text-[var(--wesal-text)]">{body}</p>
          {clock ? (
            <p className="mt-2 text-end text-[0.68rem] text-[var(--wesal-muted)]">{clock}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 h-[1.1rem] w-[1.1rem]" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
