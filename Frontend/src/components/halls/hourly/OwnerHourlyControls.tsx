"use client";

import { useEffect, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatBookingDateLabel, utcTodayIso } from "@/lib/booking-date";
import {
  blockHallDay,
  fetchOwnerHourlyControls,
  saveBookedVisibility,
} from "@/services/hourly-bookings";

type OwnerHourlyControlsProps = {
  hallId: string;
  disabled?: boolean;
};

export default function OwnerHourlyControls({ hallId, disabled = false }: OwnerHourlyControlsProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const today = utcTodayIso();
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
      .catch(() => {
        setError(t("owner.hourly.saveFailed"));
      });
  }, [hallId, t, today]);

  const selectedBlocked = Boolean(date && blockedDays.includes(date));
  const canClose = Boolean(date) && !selectedBlocked;
  const canReopen = Boolean(date) && selectedBlocked;

  const persistVisibility = async (next: boolean) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setShowBooked(await saveBookedVisibility(hallId, next));
      setNotice(t("owner.hourly.visibilitySaved"));
    } catch {
      setError(t("owner.hourly.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const persistDay = async (targetDate: string, blocked: boolean) => {
    if (!targetDate) {
      setError(t("owner.hourly.pickDate"));
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
      setError(t(blockErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-5 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4"
      data-testid="owner-hourly-controls"
    >
      <label className="flex items-start gap-3 text-sm text-[var(--wesal-text)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={showBooked}
          disabled={busy || disabled}
          onChange={(event) => {
            void persistVisibility(event.target.checked);
          }}
          data-testid="owner-show-booked-toggle"
        />
        <span>{t("owner.hourly.showBooked")}</span>
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-semibold text-[var(--wesal-text)]">
          {t("owner.hourly.blockDate")}
          <input
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy || disabled}
            className="mt-1 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={busy || disabled || !canClose}
          onClick={() => void persistDay(date, true)}
          data-testid="owner-block-day"
        >
          {t("owner.hourly.blockDay")}
        </button>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={busy || disabled || !canReopen}
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
                  disabled={busy || disabled}
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

function blockErrorKey(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) return "owner.hourly.blockOccupied";
  return "owner.hourly.saveFailed";
}
