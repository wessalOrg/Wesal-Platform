"use client";

import { useEffect, useMemo, useState } from "react";
import HallMonthCalendar from "@/components/halls/HallMonthCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatBookingDateLabel, formatBookingDateLong, utcTodayIso } from "@/lib/booking-date";
import { isHallLockedApiError } from "@/lib/hall-locked-error";
import { isPaymentRequiredApiError } from "@/lib/payment-required-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";
import {
  blockHallDay,
  fetchOwnerHourlyControls,
  saveBookedVisibility,
} from "@/services/hourly-bookings";

type OwnerHourlyControlsProps = {
  hallId: string;
  disabled?: boolean;
  paymentStatus?: HallPaymentStatus;
  /** Nested inside a parent card — drops outer border/shadow. */
  embedded?: boolean;
};

export default function OwnerHourlyControls({
  hallId,
  disabled = false,
  paymentStatus,
  embedded = false,
}: OwnerHourlyControlsProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const today = utcTodayIso();
  const unpaid = Boolean(paymentStatus && paymentStatus !== "Paid");
  const controlsLocked = disabled || unpaid;
  const [date, setDate] = useState("");
  const [showBooked, setShowBooked] = useState(true);
  const [blockedDays, setBlockedDays] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetchOwnerHourlyControls(hallId)
      .then((state) => {
        setShowBooked(state.showBookedSlots);
        setBlockedDays(upcomingBlocked(state.blockedDays, today));
      })
      .catch((err) => {
        setError(t(hourlyWriteErrorKey(err)));
      });
  }, [hallId, t, today]);

  const dayStatuses = useMemo(() => {
    const map: Record<string, "blocked"> = {};
    for (const iso of blockedDays) map[iso] = "blocked";
    return map;
  }, [blockedDays]);

  const selectedBlocked = Boolean(date && blockedDays.includes(date));
  const canClose = Boolean(date) && !selectedBlocked;
  const canReopen = Boolean(date) && selectedBlocked;

  const persistVisibility = async (next: boolean) => {
    if (unpaid) {
      setNotice(null);
      setError(t("owner.hourly.paymentRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setShowBooked(await saveBookedVisibility(hallId, next));
      setNotice(t("owner.hourly.visibilitySaved"));
    } catch (err) {
      setError(t(hourlyWriteErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const persistDay = async (targetDate: string, blocked: boolean) => {
    if (!targetDate) {
      setError(t("owner.hourly.pickDate"));
      return;
    }
    if (unpaid) {
      setNotice(null);
      setError(t("owner.hourly.paymentRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await blockHallDay({ hallId, date: targetDate, blocked });
      setBlockedDays((current) =>
        upcomingBlocked(
          blocked ? [...current, targetDate] : current.filter((iso) => iso !== targetDate),
          today,
        ),
      );
      setDate("");
      setNotice(t(blocked ? "owner.hourly.dayBlocked" : "owner.hourly.dayUnblocked"));
    } catch (err) {
      setError(t(hourlyWriteErrorKey(err, true)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={
        embedded
          ? "flex min-w-0 flex-col rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-[var(--wesal-pink-soft)] p-3.5 sm:p-4"
          : "flex min-w-0 flex-col rounded-[1.35rem] border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.06)] sm:p-5"
      }
      data-testid="owner-hourly-controls"
      aria-labelledby="hall-hourly-settings-heading"
    >
      <div className="flex items-center gap-2">
        <CalendarBadgeIcon />
        <h2
          id="hall-hourly-settings-heading"
          className="text-base font-extrabold text-[var(--wesal-maroon-dark)] sm:text-lg"
        >
          {t("owner.hourly.title")}
        </h2>
      </div>

      {unpaid ? (
        <p
          className="mt-3 rounded-xl bg-[rgba(196,160,92,0.14)] px-3 py-2 text-xs leading-5 text-[var(--wesal-text)]"
          role="status"
          data-testid="owner-hourly-payment-required"
        >
          {t("owner.hourly.paymentRequired")}
        </p>
      ) : null}

      <button
        type="button"
        role="switch"
        aria-checked={showBooked}
        disabled={busy || controlsLocked}
        className="mt-3 flex w-full items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,var(--wesal-border))] bg-[#faf6f4] px-3 py-2.5 text-start"
        data-testid="owner-show-booked-toggle"
        onClick={() => {
          void persistVisibility(!showBooked);
        }}
      >
        <span
          className={`mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
            showBooked ? "bg-[var(--wesal-maroon)]" : "bg-[#d7c6c4]"
          }`}
          aria-hidden="true"
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow transition ${
              showBooked ? "ms-auto" : ""
            }`}
          />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--wesal-text)]">
            {t("owner.hourly.showBooked")}
          </span>
          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--wesal-muted)]">
            {t("owner.hourly.showBookedHint")}
          </span>
        </span>
      </button>

      <div className="mt-3 min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,var(--wesal-border))] bg-[#f7f4f2] p-3">
        <HallMonthCalendar
          dayStatuses={dayStatuses}
          selectedDateIso={date || null}
          onSelect={(day) => {
            if (!day.dateIso || busy || controlsLocked) return;
            setDate(day.dateIso);
            setNotice(null);
            setError(null);
          }}
          disabled={busy || controlsLocked}
          locale={locale}
          legend="hourly"
          allowClosedSelect
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--wesal-text)]">{t("owner.hourly.blockDate")}</p>
          <p
            className={`mt-1 flex min-h-10 items-center rounded-xl border bg-white px-3 text-sm font-semibold ${
              date
                ? "border-[var(--wesal-maroon)] text-[var(--wesal-maroon-dark)]"
                : "border-[var(--wesal-border)] text-[var(--wesal-muted)]"
            }`}
            data-testid="owner-block-date"
          >
            {date ? formatBookingDateLong(date, locale) : t("owner.hourly.pickDate")}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e8b4b0] bg-white px-3 text-xs font-bold text-[#b42318] disabled:opacity-45"
          disabled={busy || controlsLocked || !canClose}
          onClick={() => void persistDay(date, true)}
          data-testid="owner-block-day"
        >
          <CloseIcon />
          {t("owner.hourly.blockDay")}
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--wesal-maroon)]/35 bg-white px-3 text-xs font-bold text-[var(--wesal-maroon-dark)] disabled:opacity-45"
          disabled={busy || controlsLocked || !canReopen}
          onClick={() => void persistDay(date, false)}
          data-testid="owner-unblock-day"
        >
          <CalendarBadgeIcon className="h-3.5 w-3.5" />
          {t("owner.hourly.unblockDay")}
        </button>
      </div>

      {blockedDays.length > 0 ? (
        <div className="mt-3" data-testid="owner-blocked-days">
          <p className="text-xs font-bold text-[var(--wesal-text)]">{t("owner.hourly.blockedList")}</p>
          <ul className="mt-1.5 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {blockedDays.map((iso) => (
              <li key={iso}>
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    date === iso
                      ? "bg-[var(--wesal-maroon)] text-white"
                      : "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon-dark)]"
                  }`}
                  data-date={iso}
                >
                  <button
                    type="button"
                    className="disabled:opacity-50"
                    disabled={busy || controlsLocked}
                    data-testid="owner-select-blocked-day"
                    onClick={() => {
                      setDate(iso);
                      setNotice(null);
                      setError(null);
                    }}
                  >
                    {formatBookingDateLabel(iso, locale)}
                  </button>
                  <button
                    type="button"
                    className={`leading-none disabled:opacity-50 ${
                      date === iso ? "text-white/80" : "text-[var(--wesal-muted)]"
                    }`}
                    disabled={busy || controlsLocked}
                    aria-label={t("owner.hourly.unblockDay")}
                    data-testid="owner-unblock-listed-day"
                    onClick={() => {
                      setDate(iso);
                      void persistDay(iso, false);
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-2 text-xs font-medium text-[var(--wesal-maroon)]" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function upcomingBlocked(days: string[], today: string): string[] {
  return [...new Set(days.filter((iso) => iso >= today))].sort();
}

function hourlyWriteErrorKey(err: unknown, includeOccupied = false): string {
  if (isPaymentRequiredApiError(err)) return "owner.hourly.paymentRequired";
  if (isHallLockedApiError(err)) return "owner.hourly.hallLocked";
  if (isSystemLockedApiError(err)) return "owner.hourly.systemLocked";
  if (includeOccupied && err instanceof ApiError && err.status === 409) {
    return "owner.hourly.blockOccupied";
  }
  return "owner.hourly.saveFailed";
}

function CalendarBadgeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 text-[var(--wesal-maroon)] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
