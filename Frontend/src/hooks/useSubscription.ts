"use client";

import { useHallSubscriptionStatus } from "@/hooks/useHallSubscriptionStatus";

/**
 * Hall subscription metrics from GET /owner/halls/{id}/subscription.
 * Days remaining come from the DTO or are computed from the billing/expiry date.
 */
export function useSubscription(hallId: string | null, enabled = true) {
  const state = useHallSubscriptionStatus(hallId, enabled);
  const subscription = state.subscription;

  return {
    ...state,
    subscriptionStatus: subscription?.subscriptionStatus ?? subscription?.status ?? null,
    isPaid: subscription?.isPaid ?? false,
    subscriptionExpiresAt: subscription?.subscriptionExpiresAt ?? null,
    daysRemaining: subscription?.daysRemaining ?? null,
  };
}
