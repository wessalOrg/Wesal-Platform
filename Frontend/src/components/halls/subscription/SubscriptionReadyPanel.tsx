"use client";

import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import SubscriptionStatusBadge from "@/components/halls/subscription/SubscriptionStatusBadge";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { subscriptionBillingMessageKey } from "@/lib/hall-subscription";
import { subscriptionStatusHintKey } from "@/lib/owner-subscription-ui";
import type { HallSubscription } from "@/types/hall-subscription";

type SubscriptionReadyPanelProps = {
  subscription: HallSubscription;
  hallName?: string;
};

export default function SubscriptionReadyPanel({
  subscription,
  hallName,
}: SubscriptionReadyPanelProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const billing = subscription.billing;
  const showNoBilling = !billing && (subscription.status === "unpaid" || subscription.status === "locked");
  const showExpiryWarning =
    subscription.expiryWarningDispatched &&
    Boolean(billing?.iso) &&
    (subscription.daysRemaining ?? 0) >= 0;

  return (
    <div className="min-w-0" data-testid="hall-subscription-ready" data-hall-id={subscription.hallId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {hallName ? (
            <p
              className="break-words text-sm font-semibold leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
              data-testid="hall-subscription-hall-name"
            >
              {hallName}
            </p>
          ) : null}
          <p className="mt-0.5 break-words text-sm leading-6 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
            {t(subscriptionStatusHintKey(subscription.status))}
          </p>
        </div>
        <div className="shrink-0 sm:pt-0.5">
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
      </div>

      {billing ? (
        <dl className="mt-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3 text-sm">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t(subscriptionBillingMessageKey(billing.kind))}
          </dt>
          <dd
            className="hall-sub-date mt-0.5 font-semibold text-[var(--wesal-text)]"
            data-testid="hall-subscription-billing-date"
            data-billing-kind={billing.kind}
          >
            {formatBookingDateLabel(billing.iso, locale)}
          </dd>
        </dl>
      ) : showNoBilling ? (
        <p
          className="mt-3 rounded-xl bg-[rgba(196,160,92,0.12)] px-3.5 py-3 text-sm font-medium leading-6 text-[#7a5c1f]"
          role="status"
          data-testid="hall-subscription-no-billing"
        >
          {t("owner.subscription.noActiveBilling")}
        </p>
      ) : null}

      {showExpiryWarning && billing ? (
        <div className="mt-3">
          <SubscriptionExpiryWarningBanner
            hallId={subscription.hallId}
            hallName={hallName ?? ""}
            cycleEnd={billing.iso}
            daysRemaining={subscription.daysRemaining ?? 0}
            showCta={false}
          />
        </div>
      ) : null}
    </div>
  );
}
