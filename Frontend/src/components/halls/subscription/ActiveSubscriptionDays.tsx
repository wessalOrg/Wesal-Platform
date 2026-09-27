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
      className="rounded-xl bg-[rgba(5,150,105,0.1)] px-3.5 py-2.5 text-sm font-semibold text-[#047857]"
      role="status"
      data-testid="hall-subscription-days-remaining"
    >
      {t("owner.subscription.daysRemainingLabel", { count: daysRemaining })}
    </p>
  );
}
