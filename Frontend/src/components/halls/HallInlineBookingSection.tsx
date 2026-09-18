"use client";

import { useEffect, useRef } from "react";
import CreatedBookingCancelList from "@/components/bookings/CreatedBookingCancelList";
import HallBookingPeriodList from "@/components/halls/HallBookingPeriodList";
import HallMonthCalendar from "@/components/halls/HallMonthCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useBookingInteraction } from "@/hooks/useBookingInteraction";
import { useBookingRequestForm } from "@/hooks/useBookingRequestForm";
import { useT } from "@/i18n";
import { inferBookingPeriodType } from "@/lib/booking-period";
import type { BookingRequestResult } from "@/types/booking";
import type { HallAvailabilityDay } from "@/types/hall";

export type HallInlineBookingSelection = {
  dateIso: string | null;
  dateLabel: string;
  periodLabels: string[];
  submitting: boolean;
  success: boolean;
  canConfirm: boolean;
  submit: () => void;
  errorText: string | null;
};

type HallInlineBookingSectionProps = {
  hallId: string;
  days: HallAvailabilityDay[];
  canSubmit: boolean;
  active: boolean;
  onSelectionChange?: (selection: HallInlineBookingSelection) => void;
  onSubmitted?: (result: BookingRequestResult) => void;
};

export default function HallInlineBookingSection({
  hallId,
  days,
  canSubmit,
  active,
  onSelectionChange,
  onSubmitted,
}: HallInlineBookingSectionProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const form = useBookingRequestForm({
    hallId,
    days,
    open: active,
    locale,
    canSubmit,
    onSubmitted,
  });
  const interaction = useBookingInteraction({
    canSubmit,
    dateIso: form.dateIso,
    periods: form.periods,
    periodsLoading: form.periodsLoading,
    periodsError: form.periodsError,
    selectedCount: form.selectedPeriods.length,
    submitting: form.submitting,
    success: Boolean(form.success),
    errorKey: form.errorKey,
  });

  const selectedLabels = form.periods
    .filter((period) => {
      const type = period.periodType ?? inferBookingPeriodType(period);
      return type && form.selectedPeriods.includes(type);
    })
    .map((period) => period.label);

  const errorText = form.errorKey
    ? form.errorKey.startsWith("errors.") || form.errorKey.startsWith("halls.")
      ? t(form.errorKey)
      : form.errorKey
    : null;

  useSelectionSync(onSelectionChange, {
    dateIso: form.dateIso,
    dateLabel: form.dateLabel,
    periodLabels: selectedLabels,
    submitting: form.submitting,
    success: Boolean(form.success),
    canConfirm: !interaction.submitDisabled && interaction.showSubmit,
    submit: () => {
      void form.submit();
    },
    errorText:
      interaction.phase === "conflict" || interaction.phase === "validation_error"
        ? errorText
        : null,
  });

  return (
    <section
      id="hall-booking-section"
      aria-labelledby="hall-booking-heading"
      className="hall-section-card hall-inline-booking"
      data-testid="hall-inline-booking"
      data-booking-phase={interaction.phase}
    >
      <h2
        id="hall-booking-heading"
        className="hall-section-title"
      >
        {t("halls.booking.pickSchedule")}
      </h2>

      {!interaction.showForm ? (
        interaction.phase === "restricted" ? (
          <p
            className="mt-4 rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm leading-7 text-[var(--wesal-text)]"
            role="status"
          >
            {t("halls.booking.restricted")}
          </p>
        ) : (
          <div
            className="mt-4 rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-4"
            role="status"
            data-testid="hall-booking-success"
          >
            <p className="text-sm font-semibold text-[var(--wesal-maroon)]">
              {t("halls.booking.success")}
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--wesal-text)]">
              {t("halls.booking.successDetail", {
                date: form.dateLabel,
                periods: selectedLabels.join(" · ") || form.dateLabel,
              })}
            </p>
            {form.success ? <CreatedBookingCancelList result={form.success} /> : null}
          </div>
        )
      ) : (
        <div className="mt-5 space-y-6">
          <HallMonthCalendar
            days={form.futureDays}
            selectedDateIso={form.dateIso}
            onSelect={form.selectDate}
            disabled={form.submitting}
            locale={locale}
          />
          {interaction.showPeriodArea ? (
            <HallBookingPeriodList
              periods={form.periods}
              selected={form.selectedPeriods}
              onToggle={form.togglePeriod}
              loading={form.periodsLoading}
              disabled={form.submitting}
              error={form.periodsError}
              phase={interaction.phase}
              availabilityKind={interaction.availabilityKind}
              selectedDateLabel={form.dateLabel}
            />
          ) : (
            <p className="text-sm text-[var(--wesal-muted)]">
              {t("halls.booking.pickDateFirst")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function useSelectionSync(
  onSelectionChange: ((selection: HallInlineBookingSelection) => void) | undefined,
  selection: HallInlineBookingSelection,
) {
  const submitRef = useRef(selection.submit);
  submitRef.current = selection.submit;

  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange({
      ...selection,
      submit: () => submitRef.current(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onSelectionChange,
    selection.dateIso,
    selection.dateLabel,
    selection.periodLabels.join("|"),
    selection.submitting,
    selection.success,
    selection.canConfirm,
    selection.errorText,
  ]);
}
