"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useBookingDateSelection } from "@/hooks/useBookingDateSelection";
import { useBookingSubmission } from "@/hooks/useBookingSubmission";
import { usePeriodAvailability } from "@/hooks/usePeriodAvailability";
import { usePeriodSelection } from "@/hooks/usePeriodSelection";
import {
  buildBookingRequest,
  resolveAvailabilityConflict,
  validateBookingDraft,
} from "@/lib/booking-commands";
import { futureAvailabilityDays } from "@/lib/booking-date";
import { BookingError } from "@/lib/booking-errors";
import type { BookingRequestResult } from "@/types/booking";
import type { HallAvailabilityDay } from "@/types/hall";

type Options = {
  hallId: string;
  days: HallAvailabilityDay[];
  open: boolean;
  locale: string;
  canSubmit: boolean;
  onSubmitted?: (result: BookingRequestResult) => void;
};

export function useBookingRequestForm({
  hallId,
  days,
  open,
  locale,
  canSubmit,
  onSubmitted,
}: Options) {
  const futureDays = useMemo(() => futureAvailabilityDays(days), [days]);
  const date = useBookingDateSelection(locale);
  const availability = usePeriodAvailability({
    hallId,
    dateIso: date.dateIso,
    seedDays: futureDays,
    enabled: open && Boolean(date.dateIso),
  });
  const periods = usePeriodSelection(availability.periods, date.dateIso);
  const submission = useBookingSubmission();

  useEffect(() => {
    if (open) return;
    date.reset();
    periods.reset();
    availability.reset();
    submission.reset();
    // Panel teardown only — child hook identities are stable enough per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectDate = useCallback(
    (day: HallAvailabilityDay) => {
      if (submission.submitting || submission.success) return;
      if (day.dateIso && day.dateIso === date.dateIso) return;
      date.selectDate(day);
      periods.reset();
      submission.clearFeedback();
    },
    [date, periods, submission],
  );

  const togglePeriod = useCallback(
    (type: Parameters<typeof periods.toggle>[0]) => {
      if (submission.submitting || submission.success) return;
      periods.toggle(type);
      submission.clearFeedback();
    },
    [periods, submission],
  );

  const submit = useCallback(async () => {
    if (!canSubmit || submission.submitting || submission.success) return;

    const issue = validateBookingDraft(
      { dateIso: date.dateIso, periods: periods.selected },
      availability.periods,
    );
    if (issue) {
      submission.setValidation(issue.messageKey, issue.fields);
      return;
    }

    if (!date.dateIso) return;

    try {
      const result = await submission.submit(
        buildBookingRequest(hallId, date.dateIso, periods.selected),
      );
      if (result) onSubmitted?.(result);
    } catch (err) {
      const error = err instanceof BookingError ? err : null;
      if (error?.kind === "conflict") {
        const fresh = await availability.reload();
        const resolved = resolveAvailabilityConflict(periods.selected, fresh, error);
        periods.replace(resolved.selected);
      }
    }
  }, [
    canSubmit,
    submission,
    date.dateIso,
    periods,
    availability,
    hallId,
    onSubmitted,
  ]);

  return {
    futureDays,
    dateIso: date.dateIso,
    dateLabel: date.dateLabel,
    selectDate,
    periods: availability.periods,
    periodsLoading: availability.loading,
    periodsError: availability.error,
    selectedPeriods: periods.selected,
    togglePeriod,
    submitting: submission.submitting,
    success: submission.success,
    errorKey: submission.errorKey,
    fields: submission.fields,
    submit,
  };
}
