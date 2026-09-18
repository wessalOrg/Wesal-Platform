"use client";

import SubscriptionErrorBoundary from "@/components/halls/subscription/SubscriptionErrorBoundary";
import SubscriptionStatusCard from "@/components/halls/subscription/SubscriptionStatusCard";
import { useHallSubscriptionStatus } from "@/hooks/useHallSubscriptionStatus";
import { useT } from "@/i18n";

type OwnerSubscriptionStatusProps = {
  hallId: string;
  hallName?: string;
};

export default function OwnerSubscriptionStatus({
  hallId,
  hallName,
}: OwnerSubscriptionStatusProps) {
  const t = useT();
  const { status, subscription, errorKey, retry } = useHallSubscriptionStatus(hallId, true);

  return (
    <SubscriptionErrorBoundary>
      <SubscriptionStatusCard
        hallId={hallId}
        hallName={hallName}
        loadStatus={status}
        subscription={subscription}
        errorMessage={errorKey ? t(errorKey) : null}
        onRetry={retry}
      />
    </SubscriptionErrorBoundary>
  );
}
