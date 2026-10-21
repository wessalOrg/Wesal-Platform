import { slotStartsBetween } from "@/lib/hourly-slots";
import type { HallBookingNotification, OwnerBookingRequestStatus } from "@/types/hall-notifications";
import type { OwnerManualBooking, OwnerManualEventType } from "@/types/owner-manual-booking";

const EVENT_LABELS_AR: Record<OwnerManualEventType, string> = {
  wedding: "حفل زفاف",
  engagement: "حفل خطوبة",
  graduation: "حفل تخرج",
  birthday: "عيد ميلاد",
  other: "مناسبة أخرى",
};

const EVENT_LABELS_EN: Record<OwnerManualEventType, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  graduation: "Graduation",
  birthday: "Birthday",
  other: "Other event",
};

function eventTypeLabel(type: OwnerManualEventType): string {
  const lang =
    typeof document !== "undefined" ? document.documentElement.lang?.toLowerCase() ?? "" : "";
  return lang.startsWith("en") ? EVENT_LABELS_EN[type] : EVENT_LABELS_AR[type];
}

function statusForManual(item: OwnerManualBooking): OwnerBookingRequestStatus {
  const total = item.totalAmount;
  const deposit = item.depositAmount ?? 0;
  if (total != null && total - deposit > 0) return "AcceptedPendingDeposit";
  return "FullyBooked";
}

/** Maps a calendar-created manual booking into the owner booking-requests card shape. */
export function manualBookingToNotification(
  item: OwnerManualBooking,
): HallBookingNotification {
  const status = statusForManual(item);
  const from = item.timeFrom.trim();
  const to = item.timeTo.trim();
  const slotStarts = slotStartsBetween(from, to);

  return {
    id: item.id,
    hallId: item.hallId,
    requesterName: item.customerName.trim() || "—",
    requesterUserId: "",
    requesterPhone: item.phone.trim() || undefined,
    eventTypeLabel: eventTypeLabel(item.eventType),
    date: item.date,
    periods: [],
    slotStarts,
    timeRange: from && to ? `${from} - ${to}` : undefined,
    status,
    depositAmount: item.depositAmount,
    canPublish: false,
    isPublished: status === "FullyBooked",
    canDelete: false,
  };
}

export function mergeApiNotificationsWithManual(
  apiItems: HallBookingNotification[],
  manualItems: OwnerManualBooking[],
): HallBookingNotification[] {
  const apiIds = new Set(apiItems.map((item) => item.id));
  const fromManual = manualItems
    .map(manualBookingToNotification)
    .filter((item) => !apiIds.has(item.id));

  return [...fromManual, ...apiItems].sort((left, right) => {
    const byDate = (right.date || "").localeCompare(left.date || "");
    if (byDate !== 0) return byDate;
    return right.id.localeCompare(left.id);
  });
}
