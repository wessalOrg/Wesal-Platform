import { initiateAddHall } from "@/services/add-hall-initiation";
import type { AddHallInitiationResult } from "@/types/add-hall-initiation";

const TTL_MS = 45_000;

type CacheEntry = {
  at: number;
  result: AddHallInitiationResult;
};

let cache: CacheEntry | null = null;
let warmPromise: Promise<void> | null = null;

export function peekAddHallInitiation(): AddHallInitiationResult | null {
  if (!cache) return null;
  if (Date.now() - cache.at > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.result;
}

export function rememberAddHallInitiation(result: AddHallInitiationResult): void {
  cache = { at: Date.now(), result };
}

export function clearAddHallInitiationCache(): void {
  cache = null;
}

/** Background warm so Add Hall click can navigate without waiting on the network. */
export function warmAddHallInitiation(): Promise<void> {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    try {
      const result = await initiateAddHall();
      rememberAddHallInitiation(result);
    } catch {
      // Warm is best-effort; click path still runs a live request.
    } finally {
      warmPromise = null;
    }
  })();
  return warmPromise;
}
