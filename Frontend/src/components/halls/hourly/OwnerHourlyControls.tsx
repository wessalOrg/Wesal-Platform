"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { utcTodayIso } from "@/lib/booking-date";
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
  const [date, setDate] = useState("");
  const [showBooked, setShowBooked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchOwnerHourlyControls(hallId)
      .then((state) => setShowBooked(state.showBookedSlots))
      .catch(() => {
        setError(t("owner.hourly.saveFailed"));
      });
  }, [hallId, t]);

  const persistVisibility = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setShowBooked(await saveBookedVisibility(hallId, next));
    } catch {
      setError(t("owner.hourly.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const persistBlock = async () => {
    if (!date) {
      setError(t("owner.hourly.pickDate"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await blockHallDay({ hallId, date, blocked: true });
    } catch {
      setError(t("owner.hourly.saveFailed"));
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
            min={utcTodayIso()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy || disabled}
            className="mt-1 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={busy || disabled}
          onClick={() => void persistBlock()}
          data-testid="owner-block-day"
        >
          {t("owner.hourly.blockDay")}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
