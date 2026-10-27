"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchOwnerVisitorStats } from "@/services/owner-visitor-stats";
import type {
  OwnerVisitorStats,
  OwnerVisitorStatsLoadStatus,
} from "@/types/owner-visitor-stats";

export function useOwnerVisitorStats(enabled: boolean, hallId?: string | null) {
  const [snapshot, setSnapshot] = useState<{
    requestKey: string;
    status: OwnerVisitorStatsLoadStatus;
    stats: OwnerVisitorStats | null;
  } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${hallId ?? "all"}:${retryTick}`;

  const reload = useCallback(() => {
    setRetryTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let cancelled = false;

    void fetchOwnerVisitorStats(hallId, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setSnapshot({ requestKey, stats: next, status: "ready" });
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        void err;
        setSnapshot({ requestKey, stats: null, status: "error" });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, hallId, requestKey]);

  const isCurrent = snapshot?.requestKey === requestKey;
  const currentSnapshot = isCurrent ? snapshot : null;
  const status: OwnerVisitorStatsLoadStatus = !enabled
    ? "idle"
    : currentSnapshot?.status ?? "loading";

  return { status, stats: currentSnapshot?.stats ?? null, reload, isLoading: status === "loading" };
}
