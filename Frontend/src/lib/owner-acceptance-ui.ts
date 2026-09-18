import { parseDateIso } from "@/lib/booking-date";
import { canAcceptBookingRequest } from "@/lib/owner-booking-status";
import type { BookingPeriodType } from "@/types/booking";
import type { HallBookingNotification } from "@/types/hall-notifications";

export type NotificationListGroup = "pending" | "depositPending" | "handled";

export type AcceptFeedbackKind = "cancelled" | "conflict" | "generic";

export type ScheduleSlotKind = "available" | "depositPending" | "booked" | "published";

export function notificationListGroup(
  item: HallBookingNotification,
): NotificationListGroup {
  if (item.status === "AcceptedPendingDeposit") return "depositPending";
  if (item.status === "Rejected" || item.status === "FullyBooked" || item.status === "Cancelled") {
    return "handled";
  }
  return "pending";
}

export function groupOwnerNotifications(items: HallBookingNotification[]) {
  const pending: HallBookingNotification[] = [];
  const depositPending: HallBookingNotification[] = [];
  const handled: HallBookingNotification[] = [];

  for (const item of items) {
    const group = notificationListGroup(item);
    if (group === "depositPending") depositPending.push(item);
    else if (group === "handled") handled.push(item);
    else pending.push(item);
  }

  return { pending, depositPending, handled };
}

export function acceptFeedbackKind(errorKey: string | null | undefined): AcceptFeedbackKind | null {
  if (!errorKey) return null;
  if (errorKey.includes("cancelled")) return "cancelled";
  if (errorKey.includes("conflict")) return "conflict";
  return "generic";
}

export function periodSlotKey(
  dateIso: string | null | undefined,
  period: BookingPeriodType | null | undefined,
): string | null {
  if (!dateIso || !period) return null;
  return `${dateIso}|${period}`;
}

export function depositSlotKeysFromItems(items: HallBookingNotification[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.status !== "AcceptedPendingDeposit") continue;
    const date = parseDateIso(item.date);
    if (!date) continue;
    for (const period of item.periods) {
      const key = periodSlotKey(date, period);
      if (key) keys.add(key);
    }
  }
  return keys;
}

export function mergeAcceptedSlotKeys(
  current: Set<string>,
  date: string,
  periods: BookingPeriodType[],
): Set<string> {
  const dateIso = parseDateIso(date);
  if (!dateIso || periods.length === 0) return current;
  const next = new Set(current);
  for (const period of periods) {
    const key = periodSlotKey(dateIso, period);
    if (key) next.add(key);
  }
  return next;
}

export function cardAcceptanceState(options: {
  status: HallBookingNotification["status"];
  accepting: boolean;
  errorKey?: string | null;
}): string {
  if (options.accepting) return "accepting";
  if (options.status === "AcceptedPendingDeposit") return "deposit-pending";
  if (options.status === "Cancelled") return "cancelled";
  if (options.status === "Rejected" || options.status === "FullyBooked") return "finalized";
  if (acceptFeedbackKind(options.errorKey) === "conflict") return "conflict";
  if (canAcceptBookingRequest(options.status)) return "pending";
  return "pending";
}
