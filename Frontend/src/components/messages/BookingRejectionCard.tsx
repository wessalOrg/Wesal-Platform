"use client";

import { useExpandableText } from "@/hooks/useExpandableText";
import { useT, useTranslateLang } from "@/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  bookingPeriodI18nKey,
  formatRejectionDate,
  type BookingRejectionDetails,
} from "@/lib/booking-rejection-message";

type BookingRejectionCardProps = {
  details: BookingRejectionDetails;
  sentAt: string;
  originalContent: string;
  arriving?: boolean;
};

export default function BookingRejectionCard({
  details,
  sentAt,
  originalContent,
  arriving = false,
}: BookingRejectionCardProps) {
  const t = useT();
  const { lang } = useTranslateLang();
  const periodKey = bookingPeriodI18nKey(details.period);
  const periodLabel = details.period ? t(periodKey) : t("messages.rejection.valueMissing");
  const dateLabel = details.date
    ? formatRejectionDate(details.date, lang)
    : t("messages.rejection.valueMissing");
  const hallName = details.hallName.trim() || t("messages.rejection.valueMissing");
  const reason = details.reason.trim() || t("messages.rejection.reasonMissing");

  return (
    <article
      className="flex min-w-0 justify-center px-0 sm:px-1"
      data-testid="booking-rejection-card"
      data-arriving={arriving ? "true" : "false"}
    >
      <div
        className={`w-full min-w-0 max-w-full rounded-2xl border border-[var(--wesal-border)] border-s-4 border-s-[var(--wesal-maroon)] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.08)] sm:px-4 sm:py-3.5 lg:max-w-[36rem] ${
          arriving ? "shadow-[0_10px_28px_rgba(193,123,127,0.28)] ring-1 ring-[var(--wesal-maroon)]" : ""
        }`}
      >
        <p className="text-[0.68rem] font-semibold text-[var(--wesal-gold)]">
          {t("messages.rejection.badge")}
        </p>
        <h3 className="mt-1 text-sm font-bold leading-6 text-[var(--wesal-maroon)] sm:text-[0.95rem]">
          {t("messages.rejection.title")}
        </h3>

        {details.complete ? (
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <RejectionField label={t("messages.rejection.hall")} value={hallName} />
            <RejectionField label={t("messages.rejection.date")} value={dateLabel} />
            <RejectionField label={t("messages.rejection.period")} value={periodLabel} />
            <RejectionField
              label={t("messages.rejection.reason")}
              value={reason}
              expandable
              className="sm:col-span-2"
            />
          </dl>
        ) : (
          <div className="mt-3 min-w-0" data-testid="booking-rejection-fallback">
            <p className="text-[0.82rem] leading-6 text-[var(--wesal-muted)]">
              {t("messages.rejection.unavailable")}
            </p>
            {originalContent.trim() ? (
              <ExpandableCopy text={originalContent} />
            ) : null}
          </div>
        )}

        {sentAt ? (
          <p className="mt-3 text-[0.65rem] text-[var(--wesal-muted)]">{formatRelativeTime(sentAt)}</p>
        ) : null}
      </div>
    </article>
  );
}

function RejectionField({
  label,
  value,
  expandable = false,
  className = "",
}: {
  label: string;
  value: string;
  expandable?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[0.82rem] leading-6 text-[var(--wesal-text)]">
        {expandable ? <ExpandableCopy text={value} /> : (
          <p className="break-words [overflow-wrap:anywhere]">{value}</p>
        )}
      </dd>
    </div>
  );
}

function ExpandableCopy({ text }: { text: string }) {
  const t = useT();
  const { textRef, expanded, canToggle, toggle } = useExpandableText(text);

  return (
    <div className="min-w-0">
      <p
        ref={textRef}
        className={`break-words whitespace-pre-wrap [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-4"}`}
      >
        {text}
      </p>
      {canToggle || expanded ? (
        <button
          type="button"
          className="mt-1 text-[0.7rem] font-semibold text-[var(--wesal-maroon)] underline"
          data-testid="rejection-reason-toggle"
          onClick={toggle}
        >
          {expanded ? t("messages.rejection.readLess") : t("messages.rejection.readMore")}
        </button>
      ) : null}
    </div>
  );
}
