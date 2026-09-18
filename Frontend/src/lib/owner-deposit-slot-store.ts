import {
  depositSlotKeysFromItems,
  mergeAcceptedSlotKeys,
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

export function subscribeOwnerDepositSlots(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOwnerDepositSlots(hallId: string): Set<string> {
  return slotsByHall.get(hallId) ?? EMPTY_KEYS;
}

export function getEmptyOwnerDepositSlots(): Set<string> {
  return EMPTY_KEYS;
}

export function publishOwnerDepositSlots(hallId: string, keys: Set<string>) {
  const scoped = hallId.trim();
  if (!scoped) return;
  slotsByHall.set(scoped, keys);
  notify();
}

export function publishOwnerDepositSlotsFromItems(
  hallId: string,
  items: HallBookingNotification[],
) {
  publishOwnerDepositSlots(hallId, depositSlotKeysFromItems(items));
}

export function mergeOwnerDepositSlotsFromAccept(
  hallId: string,
  date: string,
  periods: BookingPeriodType[],
) {
  const scoped = hallId.trim();
  if (!scoped) return;
  publishOwnerDepositSlots(
    scoped,
    mergeAcceptedSlotKeys(getOwnerDepositSlots(scoped), date, periods),
  );
}

export function releaseOwnerDepositSlots(
  hallId: string,
  date: string,
  periods: BookingPeriodType[],
) {
  const scoped = hallId.trim();
  if (!scoped) return;
  const current = getOwnerDepositSlots(scoped);
  if (current.size === 0) return;
  const next = new Set(current);
  for (const period of periods) {
    const key = periodSlotKey(parseDateIso(date), period);
    if (key) next.delete(key);
  }
  publishOwnerDepositSlots(scoped, next);
}
