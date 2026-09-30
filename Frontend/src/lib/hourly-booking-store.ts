import type { HourlyBookingInput, HourlyBookingResult } from "@/types/hourly-booking";

const STORAGE_KEY = "wesal-hourly-local";

type StoreShape = {
  bookings: HourlyBookingResult[];
  blockedDays: Record<string, string[]>;
  showBookedSlots: Record<string, boolean>;
};

function emptyStore(): StoreShape {
  return { bookings: [], blockedDays: {}, showBookedSlots: {} };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readStore(): StoreShape {
  if (!canUseStorage()) return emptyStore();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      blockedDays: parsed.blockedDays && typeof parsed.blockedDays === "object" ? parsed.blockedDays : {},
      showBookedSlots:
        parsed.showBookedSlots && typeof parsed.showBookedSlots === "object"
          ? parsed.showBookedSlots
          : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listHourlyBookings(hallId: string, dateIso?: string): HourlyBookingResult[] {
  return readStore().bookings.filter(
    (item) => item.hallId === hallId && (!dateIso || item.date === dateIso),
  );
}

export function isDayBlocked(hallId: string, dateIso: string): boolean {
  return (readStore().blockedDays[hallId] ?? []).includes(dateIso);
}

export function listBlockedDays(hallId: string): string[] {
  return [...(readStore().blockedDays[hallId] ?? [])];
}

export function getShowBookedSlots(hallId: string): boolean {
  return readStore().showBookedSlots[hallId] ?? true;
}

export function setShowBookedSlots(hallId: string, value: boolean) {
  const store = readStore();
  store.showBookedSlots[hallId] = value;
  writeStore(store);
}

export function setDayBlocked(hallId: string, dateIso: string, blocked: boolean) {
  const store = readStore();
  const current = new Set(store.blockedDays[hallId] ?? []);
  if (blocked) current.add(dateIso);
  else current.delete(dateIso);
  store.blockedDays[hallId] = [...current];
  writeStore(store);
}

export function addHourlyBooking(input: HourlyBookingInput): HourlyBookingResult {
  const store = readStore();
  const created: HourlyBookingResult = {
    ...input,
    bookingId: `hourly-${input.hallId}-${input.date}-${input.slotTime}-${Date.now()}`,
  };
  store.bookings.push(created);
  writeStore(store);
  return created;
}
