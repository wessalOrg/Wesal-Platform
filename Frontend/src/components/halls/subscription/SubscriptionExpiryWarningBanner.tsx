"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { ownerHallSubscriptionPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { expiryDaysRemainingMessageKey } from "@/lib/owner-subscription-ui";
import "@/components/halls/subscription/subscription-status.css";

export type SubscriptionExpiryWarningBannerProps = {
  hallId: string;
  hallName: string;
  cycleEnd: string;
  daysRemaining: number;
  showCta?: boolean;
};

export default function SubscriptionExpiryWarningBanner({
  hallId,
  hallName,
  cycleEnd,
  daysRemaining,
  showCta = true,
}: SubscriptionExpiryWarningBannerProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const name = localizeHallName(hallId, hallName, lang).trim() || hallName;
  const daysKey = expiryDaysRemainingMessageKey(daysRemaining);

  return (
    <aside
      className="hall-sub-expiry-banner rounded-2xl border border-[rgba(196,160,92,0.45)] bg-[rgba(196,160,92,0.12)] p-4 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:p-5"
      role="status"
      data-testid="subscription-expiry-warning-banner"
      data-hall-id={hallId}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-[var(--wesal-gold)]">
        {t("owner.subscription.expiryWarning.badge")}
      </p>
      <h3 className="mt-1 text-sm font-bold leading-6 text-[var(--wesal-maroon)] sm:text-base">
        {t("owner.subscription.expiryWarning.title")}
      </h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.subscription.expiryWarning.hall")}
          </dt>
          <dd
            className="mt-0.5 break-words text-sm font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere]"
            data-testid="subscription-expiry-hall-name"
          >
            {name}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.subscription.expiryWarning.remainingLabel")}
          </dt>
          <dd
            className="mt-0.5 text-sm font-semibold text-[var(--wesal-text)]"
            data-testid="subscription-expiry-days-remaining"
          >
            {t(daysKey, { count: daysRemaining })}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.subscription.expiryWarning.expiresOn")}
          </dt>
          <dd
            className="mt-0.5 text-sm font-semibold text-[var(--wesal-text)]"
            data-testid="subscription-expiry-date"
          >
            {formatBookingDateLabel(cycleEnd, locale)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-6 text-[var(--wesal-muted)]">
        {t("owner.subscription.expiryWarning.body")}
      </p>
      {showCta ? (
        <Link
          href={ownerHallSubscriptionPath(hallId)}
          className="seeker-btn-primary mt-4 inline-flex min-h-11 items-center"
          prefetch
          data-testid="subscription-expiry-renew-cta"
        >
          {t("owner.subscription.expiryWarning.cta")}
        </Link>
      ) : null}
    </aside>
  );
}
