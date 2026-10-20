import type { OwnerManualBooking } from "@/types/owner-manual-booking";

const STORAGE_KEY = "wesal_owner_manual_bookings_v1";

type Listener = () => void;

const listeners = new Set<Listener>();

function readAll(): OwnerManualBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManualBooking);
  } catch {
    return [];
  }
}

function writeAll(items: OwnerManualBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  for (const listener of listeners) listener();
}

function isManualBooking(value: unknown): value is OwnerManualBooking {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.hallId === "string" &&
    typeof row.date === "string" &&
    typeof row.customerName === "string"
  );
}

export function listOwnerManualBookings(hallId?: string): OwnerManualBooking[] {
  const all = readAll();
  if (!hallId) return all;
  return all.filter((item) => item.hallId === hallId);
}

export function addOwnerManualBooking(
  input: Omit<OwnerManualBooking, "id" | "createdAt">,
): OwnerManualBooking {
  const booking: OwnerManualBooking = {
    ...input,
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  writeAll([booking, ...readAll()]);
  return booking;
}

export function subscribeOwnerManualBookings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
