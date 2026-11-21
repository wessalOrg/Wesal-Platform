"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { MAX_TIMEOUT_MS, nextOfferBoundary, OFFER_DISCOVERY_REFRESH_MS, type OfferTimeline } from "@/lib/offer-lifecycle";

type Options = {
  enabled?: boolean;
  discoverUnloaded?: boolean;
  revalidateAtBoundary?: boolean;
  onRevalidate?: () => void | Promise<void>;
};

/** One nearest-boundary timer per list; management timelines need no polling. */
export function useOfferLifecycle(offers: readonly OfferTimeline[], {
  enabled = true, discoverUnloaded = false, revalidateAtBoundary = true, onRevalidate,
}: Options = {}) {
  const [revision, tick] = useReducer((value: number) => value + 1, 0);
  const inFlight = useRef(false);
  // Ignore unrelated data/array identity changes so they cannot restart the clock.
  const timelineKey = JSON.stringify(offers.map(({ startsAt, endsAt, stoppedAt }) => ({ startsAt, endsAt, stoppedAt })));
  const revalidate = useEffectEvent(() => {
    if (!onRevalidate || inFlight.current) return;
    inFlight.current = true;
    try {
      void Promise.resolve(onRevalidate()).catch(() => {
        // The data owner retains its existing error handling and last valid data.
      }).finally(() => { inFlight.current = false; });
    } catch { inFlight.current = false; }
  });

  useEffect(() => {
    if (!enabled) return;
    const timelines: OfferTimeline[] = JSON.parse(timelineKey);
    let timer: number | undefined;
    let disposed = false;
    let nextRefresh = discoverUnloaded ? Date.now() + OFFER_DISCOVERY_REFRESH_MS : Infinity;
    const clear = () => window.clearTimeout(timer);
    const schedule = () => {
      clear();
      if (disposed || document.visibilityState === "hidden") return;
      const now = Date.now();
      const boundary = nextOfferBoundary(timelines, now) ?? Infinity;
      const due = Math.min(boundary, nextRefresh);
      if (!Number.isFinite(due)) return;
      timer = window.setTimeout(() => {
        if (disposed || document.visibilityState === "hidden") return;
        const time = Date.now();
        const boundaryReached = time >= boundary;
        const refreshDue = time >= nextRefresh;
        if (boundaryReached || refreshDue) {
          tick();
          if ((boundaryReached && revalidateAtBoundary) || refreshDue) revalidate();
          if (refreshDue) nextRefresh = time + OFFER_DISCOVERY_REFRESH_MS;
        }
        schedule();
      }, Math.min(MAX_TIMEOUT_MS, Math.max(0, due - now)));
    };
    const resume = () => {
      if (document.visibilityState === "hidden") { clear(); return; }
      tick();
      revalidate();
      nextRefresh = discoverUnloaded ? Date.now() + OFFER_DISCOVERY_REFRESH_MS : Infinity;
      schedule();
    };
    // Catch a boundary crossed between the data render and effect setup.
    const initial = window.setTimeout(() => { if (!disposed) tick(); }, 0);
    schedule();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      disposed = true;
      clear();
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [timelineKey, enabled, discoverUnloaded, revalidateAtBoundary]);

  return revision;
}
