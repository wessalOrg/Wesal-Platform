import {
  periodSlotKey,
} from "@/lib/owner-acceptance-ui";
import { parseDateIso } from "@/lib/booking-date";
import type { BookingPeriodType } from "@/types/booking";
import type { HallBookingNotification } from "@/types/hall-notifications";

type Listener = () => void;

const EMPTY_KEYS: Set<string> = new Set();
const slotsByHall = new Map<string, Set<string>>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeOwnerPublishedSlots(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOwnerPublishedSlots(hallId: string): Set<string> {
  return slotsByHall.get(hallId) ?? EMPTY_KEYS;
}

export function getEmptyOwnerPublishedSlots(): Set<string> {
  return EMPTY_KEYS;
}

export function publishOwnerPublishedSlots(hallId: string, keys: Set<string>) {
  const scoped = hallId.trim();
  if (!scoped) return;
  slotsByHall.set(scoped, keys);
  notify();
}

export function publishedSlotKeysFromItems(items: HallBookingNotification[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.isPublished && item.status !== "FullyBooked") continue;
    const date = parseDateIso(item.date);
    if (!date) continue;
    for (const period of item.periods) {
      const key = periodSlotKey(date, period);
      if (key) keys.add(key);
    }
  }
  return keys;
}

export function publishOwnerPublishedSlotsFromItems(
  hallId: string,
  items: HallBookingNotification[],
) {
  publishOwnerPublishedSlots(hallId, publishedSlotKeysFromItems(items));
}

export function mergeOwnerPublishedSlots(
  hallId: string,
  date: string,
  periods: BookingPeriodType[],
) {
  const scoped = hallId.trim();
  if (!scoped) return;
  const dateIso = parseDateIso(date);
  if (!dateIso || periods.length === 0) return;
  const next = new Set(getOwnerPublishedSlots(scoped));
  for (const period of periods) {
    const key = periodSlotKey(dateIso, period);
    if (key) next.add(key);
  }
  publishOwnerPublishedSlots(scoped, next);
}
