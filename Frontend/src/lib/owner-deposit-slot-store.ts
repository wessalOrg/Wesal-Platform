import { depositSlotKeysFromItems } from "@/lib/owner-acceptance-ui";
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
