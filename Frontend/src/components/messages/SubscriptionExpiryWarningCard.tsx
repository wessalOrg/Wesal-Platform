"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { ownerHallSubscriptionPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { formatRelativeTime } from "@/lib/relative-time";
import { expiryDaysRemainingMessageKey } from "@/lib/owner-subscription-ui";
import type { SubscriptionExpiryWarningDetails } from "@/lib/subscription-expiry-warning-message";

type SubscriptionExpiryWarningCardProps = {
  details: SubscriptionExpiryWarningDetails;
  sentAt: string;
  originalContent: string;
  arriving?: boolean;
};

export default function SubscriptionExpiryWarningCard({
  details,
  sentAt,
  originalContent,
  arriving = false,
}: SubscriptionExpiryWarningCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const hallName =
    localizeHallName(details.hallId, details.hallName, lang).trim() ||
    t("messages.subscriptionExpiry.valueMissing");
  const daysKey = expiryDaysRemainingMessageKey(details.daysRemaining);

  return (
    <article
      className="flex min-w-0 justify-center px-0 sm:px-1"
      data-testid="subscription-expiry-warning-card"
      data-arriving={arriving ? "true" : "false"}
    >
      <div
        className={`w-full min-w-0 max-w-full rounded-2xl border border-[var(--wesal-border)] border-s-4 border-s-[var(--wesal-gold)] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.08)] sm:px-4 sm:py-3.5 lg:max-w-[36rem] ${
          arriving ? "shadow-[0_10px_28px_rgba(193,123,127,0.28)] ring-1 ring-[var(--wesal-gold)]" : ""
        }`}
      >
        <p className="text-[0.68rem] font-semibold text-[var(--wesal-gold)]">
          {t("messages.subscriptionExpiry.badge")}
        </p>
        <h3 className="mt-1 text-sm font-bold leading-6 text-[var(--wesal-maroon)] sm:text-[0.95rem]">
          {t("messages.subscriptionExpiry.title")}
        </h3>

        {details.complete ? (
          <>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                  {t("owner.subscription.expiryWarning.hall")}
                </dt>
                <dd className="mt-0.5 break-words text-[0.82rem] leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]">
                  {hallName}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                  {t("owner.subscription.expiryWarning.remainingLabel")}
                </dt>
                <dd className="mt-0.5 text-[0.82rem] leading-6 font-semibold text-[var(--wesal-text)]">
                  {t(daysKey, { count: details.daysRemaining })}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                  {t("owner.subscription.expiryWarning.expiresOn")}
                </dt>
                <dd className="mt-0.5 text-[0.82rem] leading-6 font-semibold text-[var(--wesal-text)]">
                  {details.cycleEnd
                    ? formatBookingDateLabel(details.cycleEnd, locale)
                    : t("messages.subscriptionExpiry.valueMissing")}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[0.82rem] leading-6 text-[var(--wesal-muted)]">
              {t("owner.subscription.expiryWarning.body")}
            </p>
            {details.hallId ? (
              <Link
                href={ownerHallSubscriptionPath(details.hallId)}
                className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[var(--wesal-maroon)] px-4 text-[0.78rem] font-semibold text-white"
                prefetch
                data-testid="subscription-expiry-inbox-cta"
              >
                {t("owner.subscription.expiryWarning.cta")}
              </Link>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-[0.82rem] leading-6 text-[var(--wesal-muted)]">
            {originalContent.trim() || t("messages.subscriptionExpiry.unavailable")}
          </p>
        )}

        {sentAt ? (
          <p className="mt-3 text-[0.65rem] text-[var(--wesal-muted)]">{formatRelativeTime(sentAt)}</p>
        ) : null}
      </div>
    </article>
  );
}
