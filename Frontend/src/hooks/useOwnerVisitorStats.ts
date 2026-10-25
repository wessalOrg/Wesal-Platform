"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchOwnerVisitorStats } from "@/services/owner-visitor-stats";
import type {
  OwnerVisitorStats,
  OwnerVisitorStatsLoadStatus,
} from "@/types/owner-visitor-stats";

export function useOwnerVisitorStats(enabled: boolean) {
  const [status, setStatus] = useState<OwnerVisitorStatsLoadStatus>(
    enabled ? "loading" : "idle",
  );
  const [stats, setStats] = useState<OwnerVisitorStats | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const reload = useCallback(() => {
    setRetryTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setStats(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setStatus("loading");

    void fetchOwnerVisitorStats(controller.signal)
      .then((next) => {
        if (cancelled) return;
        setStats(next);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        void err;
        setStats(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, retryTick]);

  return { status, stats, reload, isLoading: status === "loading" };
}
