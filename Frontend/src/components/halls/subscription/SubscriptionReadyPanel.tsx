"use client";

import type { ReactNode } from "react";
import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import SubscriptionStatusBadge from "@/components/halls/subscription/SubscriptionStatusBadge";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { parseDateIso } from "@/lib/booking-date";
import { subscriptionBillingMessageKey } from "@/lib/hall-subscription";
import { subscriptionStatusHintKey } from "@/lib/owner-subscription-ui";
import type { HallSubscription } from "@/types/hall-subscription";

type SubscriptionReadyPanelProps = {
  subscription: HallSubscription;
  showIllustration?: boolean;
};

function formatCycleDate(iso: string, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function utcDaySpan(startIso: string, endIso: string): number | null {
  const start = parseDateIso(startIso);
  const end = parseDateIso(endIso);
  if (!start || !end) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.round((endUtc - startUtc) / 86_400_000));
}

const FEATURE_KEYS = [
  "owner.subscription.features.ratings",
  "owner.subscription.features.unlimitedPhotos",
  "owner.subscription.features.bookings",
  "owner.subscription.features.visibility",
] as const;

export default function SubscriptionReadyPanel({
  subscription,
  showIllustration = false,
}: SubscriptionReadyPanelProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const billing = subscription.billing;
  const showNoBilling =
    !billing && (subscription.status === "unpaid" || subscription.status === "locked");
  const showExpiryWarning =
    subscription.expiryWarningDispatched &&
    Boolean(billing?.iso) &&
    (subscription.daysRemaining ?? 0) >= 0;
  const isActive = subscription.status === "active";

  const cycleEnd = subscription.subscriptionExpiresAt ?? billing?.iso ?? null;
  const cycleStart = subscription.cycleStart;
  const daysRemaining = subscription.daysRemaining;
  const totalDays =
    cycleStart && cycleEnd ? utcDaySpan(cycleStart, cycleEnd) : null;
  const safeTotal =
    totalDays != null && totalDays > 0
      ? totalDays
      : daysRemaining != null && daysRemaining > 0
        ? Math.max(daysRemaining, 30)
        : null;
  const elapsed =
    safeTotal != null && daysRemaining != null
      ? Math.max(0, safeTotal - Math.max(0, daysRemaining))
      : null;
  const progressPercent =
    safeTotal != null && elapsed != null
      ? Math.min(100, Math.max(0, Math.round((elapsed / safeTotal) * 100)))
      : null;

  if (!isActive) {
    return (
      <div
        className="min-w-0 space-y-3"
        data-testid="hall-subscription-ready"
        data-hall-id={subscription.hallId}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm leading-6 text-[var(--wesal-muted)]">
            {t(subscriptionStatusHintKey(subscription.status))}
          </p>
          <span className="sm:hidden">
            <SubscriptionStatusBadge status={subscription.status} />
          </span>
        </div>

        {billing ? (
          <dl className="rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-2.5 text-sm">
            <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
              {t(subscriptionBillingMessageKey(billing.kind))}
            </dt>
            <dd
              className="hall-sub-date mt-0.5 font-bold text-[var(--wesal-maroon-dark)]"
              data-testid="hall-subscription-billing-date"
              data-billing-kind={billing.kind}
            >
              {formatCycleDate(billing.iso, locale)}
            </dd>
          </dl>
        ) : showNoBilling ? (
          <p
            className="rounded-xl bg-[rgba(196,160,92,0.12)] px-3.5 py-2.5 text-sm font-medium leading-6 text-[#7a5c1f]"
            role="status"
            data-testid="hall-subscription-no-billing"
          >
            {t("owner.subscription.noActiveBilling")}
          </p>
        ) : null}

        {showExpiryWarning && billing ? (
          <SubscriptionExpiryWarningBanner
            hallId={subscription.hallId}
            hallName=""
            cycleEnd={billing.iso}
            daysRemaining={subscription.daysRemaining ?? 0}
            showCta={false}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="min-w-0 space-y-3"
      data-testid="hall-subscription-ready"
      data-hall-id={subscription.hallId}
    >
      <div
        className={`grid min-w-0 items-start gap-3 ${
          showIllustration ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"
        }`}
      >
        <p className="min-w-0 text-sm font-medium leading-6 text-[#047857]">
          {t(subscriptionStatusHintKey(subscription.status))}
        </p>
        {showIllustration ? (
          <div className="hall-sub-illustration -mt-1" aria-hidden="true">
            <SubscriptionCalendarArt />
          </div>
        ) : null}
      </div>

      {(cycleStart || cycleEnd || daysRemaining != null) && (
        <div className="hall-sub-timeline rounded-2xl border border-[#bbf7d0] bg-white/70 px-3 py-3 sm:px-3.5">
          {(cycleStart || cycleEnd) && (
            <div className="grid grid-cols-1 gap-3 divide-y divide-[#d1fae5] sm:grid-cols-2 sm:gap-0 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
              {cycleStart ? (
                <div className="min-w-0 sm:px-3 sm:first:ps-0 sm:last:pe-0">
                  <DateMetric
                    label={t("owner.subscription.startDate")}
                    value={formatCycleDate(cycleStart, locale)}
                    testId="hall-subscription-start-date"
                  />
                </div>
              ) : null}
              {cycleEnd ? (
                <div className="min-w-0 pt-3 sm:px-3 sm:pt-0 sm:first:ps-0 sm:last:pe-0">
                  <DateMetric
                    label={t("owner.subscription.endDate")}
                    value={formatCycleDate(cycleEnd, locale)}
                    testId="hall-subscription-end-date"
                  />
                </div>
              ) : null}
            </div>
          )}

          {(daysRemaining != null || safeTotal != null) && (
            <div className={`${cycleStart || cycleEnd ? "mt-3 border-t border-[#d1fae5] pt-3" : ""} space-y-2`}>
              <div className="grid grid-cols-2 gap-3">
                {daysRemaining != null ? (
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-medium leading-4 text-[#059669]">
                      {t("owner.subscription.remainingUntilEnd")}
                    </p>
                    <p
                      className="mt-1 text-base font-extrabold text-[#065f46]"
                      data-testid="hall-subscription-days-remaining"
                    >
                      {t("owner.subscription.daysUnit", { count: daysRemaining })}
                    </p>
                  </div>
                ) : (
                  <div />
                )}
                {safeTotal != null ? (
                  <div className="min-w-0 text-end">
                    <p className="text-[0.65rem] font-medium leading-4 text-[#059669]">
                      {t("owner.subscription.totalDuration")}
                    </p>
                    <p
                      className="mt-1 text-sm font-bold text-[#047857]"
                      data-testid="hall-subscription-total-days"
                    >
                      {t("owner.subscription.daysUnit", { count: safeTotal })}
                    </p>
                  </div>
                ) : null}
              </div>

              {progressPercent != null ? (
                <div className="pt-0.5">
                  <div
                    className="hall-sub-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                    aria-label={t("owner.subscription.progressPercent", {
                      percent: progressPercent,
                    })}
                  >
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="mt-1 text-end text-xs font-bold text-[#047857]">
                    {t("owner.subscription.progressPercent", { percent: progressPercent })}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <ul className="hall-sub-features grid grid-cols-2 gap-2">
        {FEATURE_KEYS.map((key) => (
          <li key={key} className="hall-sub-feature">
            <span className="hall-sub-feature-icon" aria-hidden="true">
              {featureIcon(key)}
            </span>
            <span className="hall-sub-feature-label">{t(key)}</span>
            <span className="hall-sub-feature-state">
              {t("owner.subscription.featureEnabled")}
            </span>
          </li>
        ))}
      </ul>

      {showExpiryWarning && billing ? (
        <SubscriptionExpiryWarningBanner
          hallId={subscription.hallId}
          hallName=""
          cycleEnd={billing.iso}
          daysRemaining={subscription.daysRemaining ?? 0}
          showCta={false}
        />
      ) : null}
    </div>
  );
}

function DateMetric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="inline-flex shrink-0 text-[#10b981]" aria-hidden="true">
          <CalendarMiniIcon />
        </span>
        <p className="min-w-0 text-[0.65rem] font-medium text-[#059669]">{label}</p>
      </div>
      <p
        className="hall-sub-date ms-1 min-w-0 text-[0.82rem] font-bold leading-5 text-[#065f46]"
        dir="rtl"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function featureIcon(key: (typeof FEATURE_KEYS)[number]): ReactNode {
  if (key === "owner.subscription.features.ratings") return <RatingsIcon />;
  if (key === "owner.subscription.features.unlimitedPhotos") return <PhotosIcon />;
  if (key === "owner.subscription.features.bookings") return <BookingsIcon />;
  return <VisibilityIcon />;
}

function SubscriptionCalendarArt() {
  return (
    <svg viewBox="0 0 120 118" className="h-[4.75rem] w-[4.5rem]" fill="none">
      <ellipse cx="60" cy="106" rx="34" ry="7" fill="#d8efe4" />
      <path
        d="M34 94c0-4.5 11-8 26-8s26 3.5 26 8v6c0 4.5-11 8-26 8s-26-3.5-26-8v-6Z"
        fill="#b7e4cd"
      />
      <rect x="36" y="22" width="48" height="58" rx="8" fill="#f0fdf6" stroke="#34d399" strokeWidth="2" />
      <rect x="36" y="22" width="48" height="14" rx="8" fill="#10b981" />
      <rect x="36" y="30" width="48" height="6" fill="#10b981" />
      <circle cx="48" cy="27" r="2.4" fill="#ecfdf5" />
      <circle cx="72" cy="27" r="2.4" fill="#ecfdf5" />
      <rect x="43" y="44" width="9" height="8" rx="1.5" fill="#a7f3d0" />
      <rect x="55.5" y="44" width="9" height="8" rx="1.5" fill="#6ee7b7" />
      <rect x="68" y="44" width="9" height="8" rx="1.5" fill="#a7f3d0" />
      <rect x="43" y="56" width="9" height="8" rx="1.5" fill="#6ee7b7" />
      <rect x="55.5" y="56" width="9" height="8" rx="1.5" fill="#34d399" />
      <g transform="translate(50 68)">
        <path
          d="M3 11h14M4 11l.8-5.5 2.8 2.4L12 3.5l2.4 4.4 2.8-2.4L18 11"
          stroke="#b45309"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M4 11h14v1.1c0 .5-.4.9-.9.9H4.9A.9.9 0 0 1 4 12.1V11Z" fill="#f59e0b" />
      </g>
    </svg>
  );
}

function CalendarMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RatingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none">
      <path d="M6 18V11M12 18V7M18 18v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 18.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PhotosIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path
        d="M7 16l3.2-3.2 2.2 2.2L16 11l3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="m9.2 14.2 1.6 1.6 3.8-3.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VisibilityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none">
      <path
        d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
