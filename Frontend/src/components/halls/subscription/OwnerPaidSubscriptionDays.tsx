"use client";

import ActiveSubscriptionDays from "@/components/halls/subscription/ActiveSubscriptionDays";
import { useSubscription } from "@/hooks/useSubscription";

type OwnerPaidSubscriptionDaysProps = {
  hallId: string;
};

/** Days remaining from GET /owner/halls/{id}/subscription — not the halls list DTO. */
export default function OwnerPaidSubscriptionDays({
  hallId,
}: OwnerPaidSubscriptionDaysProps) {
  const { status, subscription } = useSubscription(hallId, true);

  if (status !== "ready" || !subscription) return null;
  if (subscription.status !== "active" || subscription.daysRemaining == null) return null;

  return <ActiveSubscriptionDays daysRemaining={subscription.daysRemaining} />;
}
