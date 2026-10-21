"use client";

import SubscriptionErrorBoundary from "@/components/halls/subscription/SubscriptionErrorBoundary";
import SubscriptionStatusCard from "@/components/halls/subscription/SubscriptionStatusCard";
import { useSubscription } from "@/hooks/useSubscription";
import { useT } from "@/i18n";

type OwnerSubscriptionStatusProps = {
  hallId: string;
  hallName?: string;
  /** Nested inside a parent card — softer panel chrome. */
  embedded?: boolean;
};

export default function OwnerSubscriptionStatus({
  hallId,
  hallName,
  embedded = false,
}: OwnerSubscriptionStatusProps) {
  const t = useT();
  const { status, subscription, errorKey, retry } = useSubscription(hallId, true);

  return (
    <SubscriptionErrorBoundary>
      <SubscriptionStatusCard
        hallId={hallId}
        hallName={hallName}
        loadStatus={status}
        subscription={subscription}
        errorMessage={errorKey ? t(errorKey) : null}
        onRetry={retry}
        embedded={embedded}
      />
    </SubscriptionErrorBoundary>
  );
}
