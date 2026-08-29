import { buildHallDetailsPath } from "@/lib/booking-intent";

const DEAD_IDS = new Set(["", "undefined", "null", "none"]);

/** Recommendation cards must never produce `/halls/undefined` or empty routes. */
export function isNavigableHallId(hallId: string | null | undefined): boolean {
  if (typeof hallId !== "string") return false;
  const value = hallId.trim();
  if (!value || DEAD_IDS.has(value.toLowerCase())) return false;
  if (value.includes("/") || value.includes("?") || value.includes("#")) return false;
  return true;
}

export function hallDetailsHref(hallId: string): string {
  return buildHallDetailsPath(hallId.trim());
}
