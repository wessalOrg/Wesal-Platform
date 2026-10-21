"use client";

import { useT } from "@/i18n";

type ActiveSubscriptionDaysProps = {
  daysRemaining: number;
};

export default function ActiveSubscriptionDays({
  daysRemaining,
}: ActiveSubscriptionDaysProps) {
  const t = useT();

  return (
    <p
      className="hall-sub-metric hall-sub-metric--days text-sm font-semibold leading-snug"
      role="status"
      data-testid="hall-subscription-days-remaining"
    >
      {t("owner.subscription.daysRemainingLabel", { count: daysRemaining })}
    </p>
  );
}
