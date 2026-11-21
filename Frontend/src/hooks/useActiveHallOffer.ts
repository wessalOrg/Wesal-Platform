"use client";

import { useCallback, useEffect, useState } from "react";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
import { useRequestScope } from "@/hooks/useRequestScope";
import { fetchActiveHallOffer } from "@/services/hall-offers";
import type { HallOffer } from "@/types/offers";

/** Both hall detail layouts share the same active-offer request lifecycle. */
export function useActiveHallOffer(hallId: string) {
  const scope = useRequestScope();
  const [data, setData] = useState<{ hallId: string; offer: HallOffer | null } | null>(null);
  const offer = data?.hallId === hallId ? data.offer : null;
  const load = useCallback(async () => {
    const current = scope.latest("active-hall-offer");
    if (!current()) return;
    try {
      const row = await fetchActiveHallOffer(hallId);
      if (current()) setData({ hallId, offer: row });
    } catch {
      if (current()) setData({ hallId, offer: null });
    }
  }, [hallId, scope]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      scope.latest("active-hall-offer");
    };
  }, [load, scope]);
  useOfferLifecycle(offer ? [offer] : [], { discoverUnloaded: true, onRevalidate: load });
  return offer;
}
