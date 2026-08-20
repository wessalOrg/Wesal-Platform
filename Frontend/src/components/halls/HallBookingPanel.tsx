"use client";

import { useEffect } from "react";
import HallBookingCalendar from "@/components/halls/HallBookingCalendar";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import type { BookingSelection, HallAvailabilityDay } from "@/types/hall";

export type { BookingSelection };

type HallBookingPanelProps = {
  open: boolean;
  hallName: string;
  days: HallAvailabilityDay[];
  selection: BookingSelection | null;
  onSelect: (selection: BookingSelection) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function HallBookingPanel({
  open,
  hallName,
  days,
  selection,
  onSelect,
  onClose,
  onConfirm,
}: HallBookingPanelProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="hall-booking-overlay fixed inset-0 z-[110] overflow-y-auto overscroll-contain"
      role="presentation"
      data-testid="hall-booking-panel"
    >
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          className="fixed inset-0 bg-[rgba(40,25,20,0.5)] backdrop-blur-[2px]"
          aria-label={t("common.close")}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hall-booking-panel-title"
          className="hall-booking-panel relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.22)] sm:my-auto sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--wesal-border)] px-5 py-4">
            <div className="min-w-0">
              <h2
                id="hall-booking-panel-title"
                className="text-lg font-bold text-[var(--wesal-text)]"
              >
                {t("halls.booking.title")}
              </h2>
              <p className="mt-1 truncate text-sm text-[var(--wesal-muted)]">{hallName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)]"
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <HallBookingCalendar
              days={days}
              interactive
              selection={selection}
              onSelect={onSelect}
              compact
            />
          </div>

          <div className="shrink-0 border-t border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-4">
            {selection ? (
              <p className="mb-3 text-sm text-[var(--wesal-text)]">
                {t("halls.booking.selected")}{" "}
                <span className="font-semibold text-[var(--wesal-maroon)]">
                  {selection.dateLabel} · {selection.periodLabel}
                </span>
              </p>
            ) : (
              <p className="mb-3 text-sm text-[var(--wesal-muted)]">
                {t("halls.booking.pickHint")}
              </p>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={!selection}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="hall-booking-confirm"
            >
              {t("halls.booking.continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
