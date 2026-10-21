import { bookingWhenLabels } from "@/lib/booking-when-label";
import { formatBookingDateLong, localTodayIso, parseDateIso } from "@/lib/booking-date";
import { formatHourlyRange } from "@/lib/hourly-slots";
import { bookedHourRanges } from "@/lib/owner-bookings-calendar";
import type { HallBookingNotification } from "@/types/hall-notifications";
import type { OwnerBookingsCalendarDay } from "@/types/owner-bookings-calendar";
import type { OwnerManualBooking } from "@/types/owner-manual-booking";

export type OwnerCalendarBookingStatusKind = "confirmed" | "deposit" | "pending";

export type OwnerCalendarBookingCardModel = {
  id: string;
  date: string;
  title: string;
  customerName: string;
  phone?: string;
  /** Platform seeker id — enables in-app chat from the calendar card. */
  requesterUserId?: string;
  guestsLabel?: string;
  timeLabel: string;
  statusKind: OwnerCalendarBookingStatusKind;
  imageSrc: string;
  totalAmount?: number | null;
  depositAmount?: number | null;
  remainingAmount?: number | null;
};

const BOOKING_IMAGES = [
  "/hero/hall-ballroom.jpg",
  "/home/planners-aisle.png",
  "/halls/featured-lotus.webp",
  "/home/planners-card.png",
] as const;

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function bookingsForDate(
  date: string,
  notifications: HallBookingNotification[],
  day: OwnerBookingsCalendarDay | undefined,
  translate: TranslateFn,
  locale: string,
  manualBookings: OwnerManualBooking[] = [],
): OwnerCalendarBookingCardModel[] {
  const manual = manualBookings
    .filter((item) => parseDateIso(item.date) === date)
    .map((item, index) => manualToCard(item, translate, locale, index));

  const matched = notifications
    .filter((item) => parseDateIso(item.date) === date)
    .filter((item) => item.status === "Pending" || item.status === "AcceptedPendingDeposit" || item.status === "FullyBooked")
    .map((item, index) => notificationToCard(item, translate, locale, index + manual.length));

  if (manual.length > 0 || matched.length > 0) return [...manual, ...matched];

  if (!day?.hasBookedHours) return [];

  return bookedHourRanges(day.bookedHours).map((range, index) => ({
    id: `${date}-hours-${index}`,
    date,
    title: translate("owner.calendar.bookingTitle"),
    customerName: translate("owner.calendar.customerUnknown"),
    timeLabel: formatHourlyRange(range.start, range.end, locale),
    statusKind: "confirmed" as const,
    imageSrc: BOOKING_IMAGES[index % BOOKING_IMAGES.length],
  }));
}

export function upcomingBookings(
  notifications: HallBookingNotification[],
  translate: TranslateFn,
  locale: string,
  limit = 6,
  manualBookings: OwnerManualBooking[] = [],
): OwnerCalendarBookingCardModel[] {
  const today = localTodayIso();
  const fromNotifications = notifications
    .filter((item) => {
      const date = parseDateIso(item.date);
      if (!date || date < today) return false;
      return (
        item.status === "Pending" ||
        item.status === "AcceptedPendingDeposit" ||
        item.status === "FullyBooked"
      );
    })
    .map((item, index) => notificationToCard(item, translate, locale, index));

  const fromManual = manualBookings
    .filter((item) => {
      const date = parseDateIso(item.date);
      return Boolean(date && date >= today);
    })
    .map((item, index) => manualToCard(item, translate, locale, index + fromNotifications.length));

  return [...fromManual, ...fromNotifications]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, limit);
}

export function formatUpcomingDateLabel(date: string, locale: string): string {
  return formatBookingDateLong(date, locale);
}

function notificationToCard(
  item: HallBookingNotification,
  translate: TranslateFn,
  locale: string,
  index: number,
): OwnerCalendarBookingCardModel {
  const when = bookingWhenLabels(item, translate, locale);
  const deposit = item.depositAmount ?? null;
  const statusKind: OwnerCalendarBookingStatusKind =
    item.status === "FullyBooked"
      ? "confirmed"
      : item.status === "AcceptedPendingDeposit"
        ? "deposit"
        : "pending";

  const phone = item.requesterPhone?.trim() || undefined;
  const rawName = item.requesterName.trim();
  const customerName = stripPackedBookingName(rawName, phone) || translate("common.user");
  const eventLabel = item.eventTypeLabel?.trim();

  return {
    id: item.id,
    date: parseDateIso(item.date) || item.date,
    title: eventLabel || translate("owner.calendar.bookingTitle"),
    customerName,
    phone,
    requesterUserId: item.requesterUserId?.trim() || undefined,
    timeLabel:
      when.length > 0 ? when.join(locale.startsWith("ar") ? "، " : ", ") : translate("owner.notifications.valueMissing"),
    statusKind,
    imageSrc: BOOKING_IMAGES[index % BOOKING_IMAGES.length],
    depositAmount: deposit,
  };
}

/** Strip phone / event packing leftovers if an older payload still embeds them in the name. */
function stripPackedBookingName(name: string, phone: string | undefined): string {
  if (!name) return "";
  let value = name;
  if (phone) {
    const suffix = ` - ${phone}`;
    if (value.endsWith(suffix)) value = value.slice(0, -suffix.length).trim();
  }
  const eventSep = value.indexOf(" · ");
  if (eventSep >= 0) value = value.slice(0, eventSep).trim();
  return value;
}

function manualToCard(
  item: OwnerManualBooking,
  translate: TranslateFn,
  locale: string,
  index: number,
): OwnerCalendarBookingCardModel {
  const total = item.totalAmount;
  const deposit = item.depositAmount;
  const remaining =
    total != null ? Math.max(0, total - (deposit ?? 0)) : null;
  const statusKind: OwnerCalendarBookingStatusKind =
    remaining != null && remaining > 0 ? "deposit" : "confirmed";

  return {
    id: item.id,
    date: parseDateIso(item.date) || item.date,
    title: translate(`owner.calendar.add.event.${item.eventType}`),
    customerName: item.customerName.trim() || translate("common.user"),
    phone: item.phone.trim() || undefined,
    guestsLabel:
      item.guests != null
        ? translate("owner.calendar.detail.guests", { count: item.guests })
        : undefined,
    timeLabel: formatHourlyRange(item.timeFrom, item.timeTo, locale),
    statusKind,
    imageSrc: BOOKING_IMAGES[index % BOOKING_IMAGES.length],
    totalAmount: total,
    depositAmount: deposit,
    remainingAmount: remaining,
  };
}
