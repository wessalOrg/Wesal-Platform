"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hallSubscriptionErrorMessageKey,
  toHallSubscriptionError,
} from "@/lib/hall-subscription";
import { fetchHallSubscriptionStatus } from "@/services/hall-subscription";
import type {
  HallSubscription,
  HallSubscriptionLoadStatus,
} from "@/types/hall-subscription";

/**
 * Hall-scoped subscription status. Changing `hallId` drops the previous hall immediately.
 */
export function useHallSubscriptionStatus(hallId: string | null, enabled: boolean) {
  const scopedId = enabled && hallId?.trim() ? hallId.trim() : null;
  const [seenId, setSeenId] = useState<string | null>(scopedId);
  const [retryTick, setRetryTick] = useState(0);
  const [status, setStatus] = useState<HallSubscriptionLoadStatus>(scopedId ? "loading" : "idle");
  const [subscription, setSubscription] = useState<HallSubscription | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (scopedId !== seenId) {
    setSeenId(scopedId);
    setSubscription(null);
    setErrorKey(null);
    setStatus(scopedId ? "loading" : "idle");
  }

  useEffect(() => {
    if (!scopedId) return;

    const controller = new AbortController();
    let cancelled = false;

    void fetchHallSubscriptionStatus(scopedId, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setSubscription(next);
        setErrorKey(null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        const mapped = toHallSubscriptionError(err);
        setSubscription(null);
        setErrorKey(hallSubscriptionErrorMessageKey(mapped.kind));
        setStatus(mapped.kind);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [scopedId, retryTick]);

  const retry = useCallback(() => {
    if (!scopedId) return;
    setSubscription(null);
    setErrorKey(null);
    setStatus("loading");
    setRetryTick((tick) => tick + 1);
  }, [scopedId]);

  return {
    hallId: scopedId,
    status,
    subscription,
    errorKey,
    retry,
  };
}
