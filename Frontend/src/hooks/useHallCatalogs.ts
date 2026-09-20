"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { fetchHallCatalogs } from "@/services/hall-catalog";
import type { HallRegion } from "@/constants/hallRegions";

type HallCatalogsSnapshot = {
  addressesByRegion: Partial<Record<HallRegion, string[]>>;
  features: string[];
  status: "idle" | "loading" | "ready" | "error";
  hasLoaded: boolean;
};

const listeners = new Set<() => void>();

let snapshot: HallCatalogsSnapshot = {
  addressesByRegion: {},
  features: [],
  status: "idle",
  hasLoaded: false,
};

let generation = 0;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(partial: Partial<HallCatalogsSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HallCatalogsSnapshot {
  return snapshot;
}

function resetStore(): void {
  generation += 1;
  setSnapshot({
    addressesByRegion: {},
    features: [],
    status: "idle",
    hasLoaded: false,
  });
}

async function loadCatalogs(): Promise<void> {
  if (snapshot.hasLoaded) return;
  const gen = ++generation;
  if (snapshot.status !== "loading") {
    setSnapshot({ status: "loading" });
  }
  try {
    const next = await fetchHallCatalogs();
    if (gen !== generation) return;
    setSnapshot({
      addressesByRegion: next.addressesByRegion,
      features: next.features,
      status: "ready",
      hasLoaded: true,
    });
  } catch {
    if (gen !== generation) return;
    setSnapshot({ status: "error" });
  }
}

/**
 * Lazy singleton store for the region→address catalog + predefined features.
 * Fetched at most once per session for authenticated users; consumed by the
 * Add/Edit Hall forms (US-HALL).
 */
export function useHallCatalogs() {
  const { ready, authenticated } = useAccountAccess();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      resetStore();
      return;
    }
    void loadCatalogs();
  }, [ready, authenticated]);

  const refetch = useCallback(() => {
    generation += 1;
    setSnapshot({
      addressesByRegion: {},
      features: [],
      status: "idle",
      hasLoaded: false,
    });
    void loadCatalogs();
  }, []);

  const addressesFor = useCallback(
    (region: HallRegion | ""): string[] => {
      if (!region) return [];
      return state.addressesByRegion[region] ?? [];
    },
    [state.addressesByRegion],
  );

  return {
    addressesByRegion: state.addressesByRegion,
    addressesFor,
    features: state.features,
    status: state.status,
    hasLoaded: state.hasLoaded,
    refetch,
  };
}