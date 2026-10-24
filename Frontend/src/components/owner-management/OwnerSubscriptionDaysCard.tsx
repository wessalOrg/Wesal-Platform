"use client";

import { useT } from "@/i18n";

type OwnerSubscriptionDaysCardProps = {
  daysRemaining: number | null;
  totalDays?: number;
  /** True when the paid cycle has ended / hall is system-locked. */
  expired?: boolean;
  loading?: boolean;
};

const DEFAULT_TOTAL = 30;

export default function OwnerSubscriptionDaysCard({
  daysRemaining,
  totalDays = DEFAULT_TOTAL,
  expired = false,
  loading = false,
}: OwnerSubscriptionDaysCardProps) {
  const t = useT();
  const safeTotal = totalDays > 0 ? totalDays : DEFAULT_TOTAL;
  const ended = expired || (daysRemaining != null && daysRemaining <= 0);
  const remaining = ended ? 0 : Math.max(0, daysRemaining ?? 0);
  const elapsed = Math.min(safeTotal, Math.max(0, safeTotal - remaining));
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / safeTotal) * 100)));

  if (loading) {
    return (
      <div
        className="h-full min-h-[9.5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
        aria-busy="true"
        data-testid="owner-subscription-days-card-loading"
      />
    );
  }

  if (daysRemaining == null && !ended) {
    return (
      <section
        className="flex h-full min-h-[9.5rem] flex-col justify-center rounded-2xl border border-[rgba(168,98,103,0.16)] bg-[#faf7f5] p-3.5 sm:p-4"
        data-testid="owner-subscription-days-card"
        data-state="empty"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)]">
            <CrownIcon />
          </span>
          <h2 className="text-sm font-extrabold text-[var(--wesal-text)]">
            {t("owner.subscriptionDaysCard.title")}
          </h2>
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--wesal-muted)]">
          {t("owner.subscriptionDaysCard.noActive")}
        </p>
      </section>
    );
  }

  const tone = ended
    ? {
        card: "border-[#fca5a5] bg-gradient-to-br from-[#fef2f2] via-white to-[#fee2e2]",
        iconWrap: "bg-[#fecaca] text-[#b91c1c]",
        title: "text-[#991b1b]",
        panel: "border-[#fecaca] bg-white/90",
        label: "text-[#b91c1c]/80",
        value: "text-[#b91c1c]",
        track: "bg-[#fecaca]",
        bar: "bg-gradient-to-l from-[#f87171] to-[#dc2626]",
        percent: "text-[#b91c1c]",
      }
    : {
        card: "border-[#86efac] bg-gradient-to-br from-[#f3fbf7] via-white to-[#eef9f3]",
        iconWrap: "bg-[#bbf7d0] text-[#047857]",
        title: "text-[#065f46]",
        panel: "border-[#bbf7d0] bg-white/90",
        label: "text-[#047857]/80",
        value: "text-[#065f46]",
        track: "bg-[#d1fae5]",
        bar: "bg-gradient-to-l from-[#6ee7b7] to-[#059669]",
        percent: "text-[#047857]",
      };

  return (
    <section
      className={`flex h-full min-h-[9.5rem] flex-col rounded-2xl border p-3.5 shadow-[0_8px_20px_rgba(90,55,45,0.05)] sm:p-4 ${tone.card}`}
      aria-labelledby="owner-subscription-days-heading"
      data-testid="owner-subscription-days-card"
      data-state={ended ? "expired" : "active"}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
          aria-hidden="true"
        >
          <CrownIcon />
        </span>
        <h2
          id="owner-subscription-days-heading"
          className={`text-sm font-extrabold leading-5 ${tone.title}`}
        >
          {t("owner.subscriptionDaysCard.title")}
        </h2>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2.5 ${tone.panel}`}>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 text-start">
            <p className={`text-[0.65rem] font-bold leading-4 ${tone.label}`}>
              {t("owner.subscription.remainingUntilEnd")}
            </p>
            <p className={`mt-0.5 text-[0.95rem] font-extrabold leading-5 tabular-nums ${tone.value}`}>
              {ended
                ? t("owner.subscriptionDaysCard.expiredCaption")
                : t("owner.subscription.daysUnit", { count: remaining })}
            </p>
          </div>
          <div className="min-w-0 text-start">
            <p className={`text-[0.65rem] font-bold leading-4 ${tone.label}`}>
              {t("owner.subscription.totalDuration")}
            </p>
            <p className={`mt-0.5 text-[0.95rem] font-extrabold leading-5 tabular-nums ${tone.value}`}>
              {t("owner.subscription.daysUnit", { count: safeTotal })}
            </p>
          </div>
        </div>

        <div className={`mt-2.5 h-2 overflow-hidden rounded-full ${tone.track}`}>
          <span
            className={`block h-full rounded-full transition-[width] ${tone.bar}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className={`mt-1 text-[0.68rem] font-extrabold tabular-nums ${tone.percent}`}>
          {t("owner.subscription.progressPercent", { percent: progressPercent })}
        </p>
      </div>
    </section>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M4.5 17.5h15M5 17.5 6.2 9.8l3.6 3.2L12 7.5l2.2 5.5 3.6-3.2L19 17.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
