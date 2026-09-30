"use client";

import { useEffect, useMemo, useState } from "react";
import HallMonthCalendar from "@/components/halls/HallMonthCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatBookingDateLabel, utcTodayIso } from "@/lib/booking-date";
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
};

export default function OwnerHourlyControls({
  hallId,
  disabled = false,
  paymentStatus,
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
      setNotice(t(blocked ? "owner.hourly.dayBlocked" : "owner.hourly.dayUnblocked"));
    } catch (err) {
      setError(t(hourlyWriteErrorKey(err, true)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-5 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4"
      data-testid="owner-hourly-controls"
    >
      {unpaid ? (
        <p
          className="mb-3 rounded-xl bg-[rgba(196,160,92,0.14)] px-3 py-2 text-sm leading-6 text-[var(--wesal-text)]"
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
        className="flex w-full items-start gap-3 rounded-xl bg-white px-3 py-3 text-start"
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
          <span className="block text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.hourly.showBooked")}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--wesal-muted)]">
            {t("owner.hourly.showBookedHint")}
          </span>
        </span>
      </button>

      <p className="mt-4 text-sm font-semibold text-[var(--wesal-text)]">
        {t("owner.hourly.blockDay")}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--wesal-muted)]">{t("owner.hourly.blockHint")}</p>
      <div className="mt-3">
        <HallMonthCalendar
          dayStatuses={dayStatuses}
          selectedDateIso={date || null}
          onSelect={(day) => {
            if (!day.dateIso || busy || controlsLocked) return;
            setDate(day.dateIso);
            void persistDay(day.dateIso, !blockedDays.includes(day.dateIso));
          }}
          disabled={busy || controlsLocked}
          locale={locale}
          legend="hourly"
          allowClosedSelect
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-semibold text-[var(--wesal-text)]">
          {t("owner.hourly.blockDate")}
          <input
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy || controlsLocked}
            className="mt-1 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={busy || controlsLocked || !canClose}
          onClick={() => void persistDay(date, true)}
          data-testid="owner-block-day"
        >
          {t("owner.hourly.blockDay")}
        </button>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={busy || controlsLocked || !canReopen}
          onClick={() => void persistDay(date, false)}
          data-testid="owner-unblock-day"
        >
          {t("owner.hourly.unblockDay")}
        </button>
      </div>

      {blockedDays.length > 0 ? (
        <div className="mt-4" data-testid="owner-blocked-days">
          <p className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.hourly.blockedList")}
          </p>
          <ul className="mt-2 space-y-2">
            {blockedDays.map((iso) => (
              <li
                key={iso}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-[var(--wesal-text)]">
                  {formatBookingDateLabel(iso, locale)}
                </span>
                <button
                  type="button"
                  className="btn-outline min-h-9 shrink-0 px-3 text-sm"
                  disabled={busy || controlsLocked}
                  data-date={iso}
                  data-testid="owner-unblock-listed-day"
                  onClick={() => {
                    setDate(iso);
                    void persistDay(iso, false);
                  }}
                >
                  {t("owner.hourly.unblockDay")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-3 text-sm text-[var(--wesal-maroon)]" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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
