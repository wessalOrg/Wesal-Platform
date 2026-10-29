"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HallMonthCalendar, {
  type CalendarDayStatus,
} from "@/components/halls/HallMonthCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import OwnerCalendarBookingCard from "@/components/owner-management/halls/OwnerCalendarBookingCard";
import { useHallNotifications } from "@/hooks/useHallNotifications";
import { useOwnerBookingsCalendar } from "@/hooks/useOwnerBookingsCalendar";
import { useOwnerSeekerChat } from "@/hooks/useOwnerSeekerChat";
import { useT } from "@/i18n";
import { formatBookingDateLong, localTodayIso, parseDateIso } from "@/lib/booking-date";
import {
  bookingsForDate,
  formatUpcomingDateLabel,
  upcomingBookings,
} from "@/lib/owner-calendar-bookings";
import type { OwnerBookingsCalendarStatus } from "@/types/owner-bookings-calendar";
import type { HallBookingNotification } from "@/types/hall-notifications";
import type { OwnerManualBooking } from "@/types/owner-manual-booking";

type OwnerHallBookingsCalendarProps = {
  hallId: string;
  enabled: boolean;
  /** Standalone page labels the details column. The hall notifications card already has its own title. */
  detailsTitle?: boolean;
  /** Prefill / focus a day after creating a booking from the page modal. */
  focusDate?: string | null;
};

type MonthRange = { fromDate: string; toDate: string };
const NO_LEGACY_BOOKINGS: OwnerManualBooking[] = [];

export default function OwnerHallBookingsCalendar({
  hallId,
  enabled,
  focusDate = null,
}: OwnerHallBookingsCalendarProps) {
  const t = useT();
  const locale = useUiLang();
  const dateLocale = locale === "ar" ? "ar-EG" : "en-GB";
  const { load, range, onVisibleMonthChange, retry } = useOwnerBookingsCalendar(hallId, enabled);
  const notifications = useHallNotifications(hallId, enabled, range);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => localTodayIso());
  const manualBookings = NO_LEGACY_BOOKINGS;

  useEffect(() => {
    const iso = parseDateIso(focusDate);
    if (iso) setSelectedDate(iso);
  }, [focusDate]);

  const notificationItems = notifications.items;

  const dayStatuses = useMemo(() => {
    if (load.status !== "ready") return undefined;
    const statuses: Record<string, CalendarDayStatus> = {};
    for (const day of load.calendar.days) {
      statuses[day.date] = day.hasBookedHours ? "booked" : "available";
    }
    for (const booking of manualBookings) {
      const date = parseDateIso(booking.date);
      if (date) statuses[date] = "booked";
    }
    return statuses;
  }, [load, manualBookings]);

  const selectedInView = isDateInRange(selectedDate, range);
  const activeDate = selectedInView ? selectedDate : null;
  const upcoming = upcomingBookings(notificationItems, t, dateLocale, 6, manualBookings);

  return (
    <div
      className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-5"
      data-testid="owner-bookings-calendar"
      data-hall-id={hallId}
    >
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.05)] sm:p-5">
          <HallMonthCalendar
            dayStatuses={dayStatuses}
            selectedDateIso={activeDate}
            onSelect={(day) => {
              const iso = day.dateIso ?? null;
              if (iso) setSelectedDate(iso);
            }}
            disabled={!enabled}
            locale={locale}
            legend="owner"
            allowAnyDay
            showTodayButton
            hideLegend
            onVisibleMonthChange={onVisibleMonthChange}
          />
        </section>

        <UpcomingBookingsRail
          hallId={hallId}
          items={upcoming}
          locale={dateLocale}
          onPickDate={(date) => setSelectedDate(date)}
        />
      </div>

      <div className="order-1 min-w-0 lg:order-2">
        <SelectedDayPanel
          hallId={hallId}
          selectedDate={activeDate}
          load={load}
          notifications={notificationItems}
          manualBookings={manualBookings}
          locale={dateLocale}
          onRetry={retry}
        />
      </div>
    </div>
  );
}

function SelectedDayPanel({
  hallId,
  selectedDate,
  load,
  notifications,
  manualBookings,
  locale,
  onRetry,
}: {
  hallId: string;
  selectedDate: string | null;
  load: OwnerBookingsCalendarStatus;
  notifications: HallBookingNotification[];
  manualBookings: OwnerManualBooking[];
  locale: string;
  onRetry: () => void;
}) {
  const t = useT();
  const seekerChat = useOwnerSeekerChat();

  if (load.status === "error") {
    return (
      <CalendarDayError
        heading={selectedDate ? formatBookingDateLong(selectedDate, locale) : null}
        onRetry={onRetry}
      />
    );
  }

  if (!selectedDate) {
    return (
      <p
        className="flex min-h-40 flex-col justify-center rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white px-4 py-6 text-sm leading-7 text-[var(--wesal-muted)] shadow-[0_10px_28px_rgba(90,55,45,0.04)]"
        data-testid="owner-calendar-idle"
      >
        {t("owner.calendar.pickDay")}
      </p>
    );
  }

  const heading = formatBookingDateLong(selectedDate, locale);

  if (load.status === "loading" || load.status === "idle") {
    return (
      <section
        className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(90,55,45,0.05)]"
        aria-busy="true"
        aria-live="polite"
        data-testid="owner-calendar-loading"
      >
        <DayHeader heading={heading} countLabel={t("owner.calendar.loading")} />
      </section>
    );
  }

  const day = load.calendar.days.find((item) => item.date === selectedDate);
  const cards = bookingsForDate(
    selectedDate,
    notifications,
    day,
    t,
    locale,
    manualBookings,
  );

  if (cards.length === 0) {
    return (
      <section
        className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(90,55,45,0.05)]"
        role="status"
        aria-live="polite"
        data-testid="owner-calendar-empty"
      >
        <DayHeader heading={heading} countLabel={t("owner.calendar.dayCount", { count: 0 })} />
        <p className="mt-4 text-sm font-semibold leading-7 text-[var(--wesal-text)]">
          {t("owner.calendar.empty")}
        </p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-3" data-testid="owner-calendar-booked">
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(90,55,45,0.05)]">
        <DayHeader
          heading={heading}
          countLabel={t("owner.calendar.dayCount", { count: cards.length })}
        />
      </div>
      <ul className="space-y-3">
        {cards.map((booking) => (
          <li key={booking.id}>
            <OwnerCalendarBookingCard
              booking={booking}
              detailsHref={`/owner/halls/${encodeURIComponent(hallId)}/notifications?request_id=${encodeURIComponent(booking.id)}`}
              messagingSeeker={seekerChat.opening}
              onMessageSeeker={(item) => {
                void seekerChat.openWithSeeker(hallId, item.requesterUserId);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayHeader({ heading, countLabel }: { heading: string; countLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-[var(--wesal-text)] sm:text-lg">{heading}</h2>
        <p className="mt-1 text-[0.78rem] text-[var(--wesal-muted)]">{countLabel}</p>
      </div>
      <span className="mt-1 inline-flex text-[var(--wesal-maroon)]" aria-hidden="true">
        <HeaderChevron />
      </span>
    </div>
  );
}

function UpcomingBookingsRail({
  hallId,
  items,
  locale,
  onPickDate,
}: {
  hallId: string;
  items: ReturnType<typeof upcomingBookings>;
  locale: string;
  onPickDate: (date: string) => void;
}) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.05)] sm:p-5"
      data-testid="owner-calendar-upcoming"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-[var(--wesal-text)] sm:text-base">
          {t("owner.calendar.upcoming")}
        </h3>
        <Link
          href={`/owner/halls/${encodeURIComponent(hallId)}/notifications`}
          className="inline-flex items-center gap-1 text-[0.78rem] font-bold text-[var(--wesal-maroon)]"
        >
          {t("owner.calendar.viewAll")}
          <span className="rtl:rotate-180" aria-hidden="true">
            ‹
          </span>
        </Link>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={`upcoming-${item.id}`} className="min-w-0">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-[#faf8f6] p-2.5 text-start transition hover:bg-[var(--wesal-pink-soft)]"
              onClick={() => onPickDate(item.date)}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#efe8e2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageSrc} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[var(--wesal-text)]">{item.title}</p>
                <p className="mt-0.5 truncate text-[0.72rem] text-[var(--wesal-muted)]">
                  {formatUpcomingDateLabel(item.date, locale)}
                </p>
                <p dir="ltr" className="mt-0.5 truncate text-[0.72rem] font-semibold text-[var(--wesal-text)]">
                  {item.timeLabel}
                </p>
              </div>
              <span className="text-[var(--wesal-maroon)]" aria-hidden="true">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path
                    d="M4.5 7.5 10 13l5.5-5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CalendarDayError({
  heading,
  onRetry,
}: {
  heading: string | null;
  onRetry: () => void;
}) {
  const t = useT();

  return (
    <section
      className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(90,55,45,0.05)]"
      role="alert"
      data-testid="owner-calendar-error"
    >
      {heading ? (
        <h4 className="text-base font-extrabold text-[var(--wesal-maroon)]">{heading}</h4>
      ) : null}
      <p className={`${heading ? "mt-3" : ""} text-sm leading-7 text-[var(--wesal-muted)]`}>
        {t("owner.calendar.error")}
      </p>
      <button
        type="button"
        className="btn-outline mt-4 inline-flex min-h-11 items-center px-4"
        onClick={onRetry}
      >
        {t("common.retry")}
      </button>
    </section>
  );
}

function HeaderChevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5 10 13l5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isDateInRange(date: string | null, range: MonthRange | null): boolean {
  if (!date || !range) return false;
  return date >= range.fromDate && date <= range.toDate;
}
