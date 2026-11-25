"use client";

import { useT } from "@/i18n";
import { useSubscription } from "@/hooks/useSubscription";

type OwnerPaidSubscriptionDaysProps = {
  hallId: string;
};

/** Compact note from GET /owner/halls/{id}/subscription — not the halls list DTO. */
export default function OwnerPaidSubscriptionDays({
  hallId,
}: OwnerPaidSubscriptionDaysProps) {
  const t = useT();
  const { status, subscription } = useSubscription(hallId, true);

  if (status !== "ready" || !subscription) return null;

  const days = subscription.daysRemaining;
  const finished =
    subscription.status === "expired";
  if (finished) {
    return <SubscriptionEndedNote label={t("owner.subscription.hallsExpiredNote")} />;
  }

  if (subscription.status !== "active" || days == null) return null;

  return (
    <p
      className="text-sm font-semibold text-[#047857]"
      role="status"
      data-testid="hall-subscription-days-note"
    >
      {t("owner.subscription.hallsDaysNote", { count: days })}
    </p>
  );
}

function SubscriptionEndedNote({ label }: { label: string }) {
  return (
    <p
      className="text-sm font-semibold text-[#b42318]"
      role="alert"
      data-testid="hall-subscription-ended-note"
    >
      {label}
    </p>
  );
}
