"use client";

import { useMemo, useState } from "react";
import type { HallDetails } from "@/types/hall";

type HallBookingPanelProps = {
  hall: HallDetails;
};

export default function HallBookingPanel({ hall }: HallBookingPanelProps) {
  const days = hall.availabilityDays ?? [];
  const [dayIndex, setDayIndex] = useState(() =>
    Math.max(
      0,
      days.findIndex((day) => day.periods.some((period) => period.status === "available")),
    ),
  );
  const [periodIndex, setPeriodIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedDay = days[dayIndex] ?? null;
  const selectedPeriod =
    selectedDay && periodIndex != null ? selectedDay.periods[periodIndex] : null;
  const canConfirm =
    selectedDay != null &&
    selectedPeriod != null &&
    selectedPeriod.status === "available";

  const summary = useMemo(() => {
    if (!selectedDay || !selectedPeriod) {
      return "اختاري تاريخاً وفترة متاحة لإكمال الحجز.";
    }
    if (selectedPeriod.status === "booked") {
      return "هالفترة محجوزة. اختاري فترة ثانية.";
    }
    return `${selectedDay.dateLabel} · ${selectedPeriod.label}${
      selectedPeriod.time ? ` · ${selectedPeriod.time}` : ""
    }`;
  }, [selectedDay, selectedPeriod]);

  if (days.length === 0) {
    return (
      <section
        id="hall-booking"
        className="mt-7 rounded-2xl bg-[#f7f1ec] px-4 py-5 sm:px-6"
        data-testid="hall-booking-empty"
      >
        <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">الحجز</h2>
        <p className="mt-2 text-sm leading-7 text-[#8a7a70]">
          لا توجد أوقات متاحة للعرض حالياً.
        </p>
      </section>
    );
  }

  return (
    <section
      id="hall-booking"
      className="mt-7"
      data-testid="hall-booking-panel"
    >
      <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">الحجز</h2>
      <p className="mt-1 text-sm text-[#8a7a70]">اختاري التاريخ ثم الفترة.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="hall-booking-dates">
        {days.map((day, index) => {
          const hasOpen = day.periods.some((period) => period.status === "available");
          const active = index === dayIndex;
          return (
            <button
              key={`${day.dateLabel}-${index}`}
              type="button"
              disabled={!hasOpen}
              onClick={() => {
                setDayIndex(index);
                setPeriodIndex(null);
                setSubmitted(false);
              }}
              className={`min-w-[7.5rem] shrink-0 rounded-xl px-3 py-3 text-sm font-bold transition ${
                active
                  ? "bg-[var(--wesal-maroon-dark)] text-white"
                  : "bg-[#f7f1ec] text-[var(--wesal-maroon)]"
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              {day.dateLabel}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2" data-testid="hall-booking-periods">
          {selectedDay.periods.map((period, index) => {
            const booked = period.status === "booked";
            const active = periodIndex === index;
            return (
              <button
                key={`${period.label}-${index}`}
                type="button"
                disabled={booked}
                onClick={() => {
                  setPeriodIndex(index);
                  setSubmitted(false);
                }}
                className={`rounded-xl px-3 py-3 text-start text-sm transition ${
                  active
                    ? "bg-[var(--wesal-pink-soft)] ring-2 ring-[var(--wesal-maroon)]"
                    : "bg-[#f7f1ec]"
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="block font-bold text-[var(--wesal-maroon)]">
                  {period.label}
                </span>
                {period.time ? (
                  <span className="mt-1 block text-[#8a7a70]">{period.time}</span>
                ) : null}
                <span className="mt-1 block text-xs font-semibold text-[#8a7a70]">
                  {booked ? "محجوزة" : "متاحة"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-[#f7f1ec] px-4 py-4">
        <p className="text-sm font-bold text-[var(--wesal-maroon)]">ملخص الحجز</p>
        <p className="mt-1 text-sm leading-7 text-[#4a403c]">{summary}</p>
        {hall.priceLabel ? (
          <p className="mt-1 text-sm text-[#8a7a70]">{hall.priceLabel}</p>
        ) : null}
        <button
          type="button"
          className="btn-primary mt-4 min-h-11 w-full !rounded-xl !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:w-auto sm:!min-h-12"
          disabled={!canConfirm}
          data-testid="hall-booking-confirm"
          onClick={() => setSubmitted(true)}
        >
          تأكيد الحجز
        </button>
        {submitted ? (
          <p className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]" role="status">
            تم تجهيز طلب الحجز لهذه القاعة.
          </p>
        ) : null}
      </div>
    </section>
  );
}
