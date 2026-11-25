"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hallSubscriptionErrorMessageKey,
  toHallSubscriptionError,
} from "@/lib/hall-subscription";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { applyOwnedHallSubscriptionStatus } from "@/hooks/useHallOwnerHalls";
import { fetchScopedHallSubscription } from "@/lib/hall-subscription-requests";
import type {
  HallSubscription,
  HallSubscriptionLoadStatus,
} from "@/types/hall-subscription";

/**
 * Session- and hall-scoped status. Obsolete responses never update visible state.
 */
export function useHallSubscriptionStatus(hallId: string | null, enabled: boolean) {
  const scopedId = enabled && hallId?.trim() ? hallId.trim() : null;
  const { account, scope, isCurrent } = useAuthenticatedRequestScope(enabled, scopedId ?? "");
  const [seenScope, setSeenScope] = useState(scope);
  const [seenId, setSeenId] = useState<string | null>(scopedId);
  const [retryTick, setRetryTick] = useState(0);
  const [status, setStatus] = useState<HallSubscriptionLoadStatus>(scopedId && account ? "loading" : "idle");
  const [subscription, setSubscription] = useState<HallSubscription | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (scopedId !== seenId || seenScope !== scope) {
    setSeenScope(scope);
    setSeenId(scopedId);
    setSubscription(null);
    setErrorKey(null);
    setStatus(scopedId ? "loading" : "idle");
  }

  useEffect(() => {
    if (!scopedId || !account) return;

    let cancelled = false;

    void fetchScopedHallSubscription(account, scopedId)
      .then((next) => {
        if (cancelled || !isCurrent()) return;
        if (next.hallId !== scopedId) throw new Error("Unexpected subscription hall identity");
        applyOwnedHallSubscriptionStatus(account, scopedId, next.status);
        setSubscription(next);
        setErrorKey(null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled || !isCurrent()) return;
        const mapped = toHallSubscriptionError(err);
        setSubscription(null);
        setErrorKey(hallSubscriptionErrorMessageKey(mapped.kind));
        setStatus(mapped.kind);
      });

    return () => {
      cancelled = true;
    };
  }, [scopedId, retryTick, account, isCurrent]);

  const retry = useCallback(() => {
    if (!scopedId || !isCurrent()) return;
    setSubscription(null);
    setErrorKey(null);
    setStatus("loading");
    setRetryTick((tick) => tick + 1);
  }, [scopedId, isCurrent]);

  return {
    hallId: scopedId,
    status,
    subscription,
    errorKey,
    retry,
  };
}
