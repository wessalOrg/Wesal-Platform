"use client";

import { useMemo } from "react";
import { useBookingViewport } from "@/hooks/useBookingViewport";
import {
  bookingPhaseShowsForm,
  countAvailablePeriods,
  periodAvailabilityKind,
  resolveBookingUiPhase,
  type BookingUiPhase,
  type PeriodAvailabilityKind,
} from "@/lib/booking-ui-state";
import type { HallDayPeriod } from "@/types/hall";

type BookingInteractionInput = {
  canSubmit: boolean;
  dateIso: string | null;
  periods: HallDayPeriod[];
  periodsLoading: boolean;
  periodsError: string | null;
  selectedCount: number;
  submitting: boolean;
  success: boolean;
  errorKey: string | null;
};

export type BookingInteraction = {
  viewport: ReturnType<typeof useBookingViewport>;
  phase: BookingUiPhase;
  availabilityKind: PeriodAvailabilityKind;
  availableCount: number;
  showForm: boolean;
  showPeriodArea: boolean;
  showSubmit: boolean;
  submitDisabled: boolean;
};

/**
 * Interaction view-model only. Submit still goes through Lilian's
 * `useBookingRequestForm` / `submitBookingRequest`.
 */
export function useBookingInteraction(input: BookingInteractionInput): BookingInteraction {
  const viewport = useBookingViewport();
  const availableCount = countAvailablePeriods(input.periods);
  const availabilityKind = periodAvailabilityKind(input.periods);

  const phase = useMemo(
    () =>
      resolveBookingUiPhase({
        canSubmit: input.canSubmit,
        dateIso: input.dateIso,
        periodsLoading: input.periodsLoading,
        periodsError: input.periodsError,
        periodCount: input.periods.length,
        availableCount,
        submitting: input.submitting,
        success: input.success,
        errorKey: input.errorKey,
      }),
    [
      input.canSubmit,
      input.dateIso,
      input.periodsLoading,
      input.periodsError,
      input.periods.length,
      availableCount,
      input.submitting,
      input.success,
      input.errorKey,
    ],
  );

  const showForm = bookingPhaseShowsForm(phase);
  const showPeriodArea = Boolean(input.dateIso) && showForm;
  const showSubmit = showForm;
  const submitDisabled =
    !input.canSubmit ||
    input.submitting ||
    input.periodsLoading ||
    !input.dateIso ||
    input.selectedCount === 0 ||
    phase === "all_unavailable" ||
    phase === "empty";

  return {
    viewport,
    phase,
    availabilityKind,
    availableCount,
    showForm,
    showPeriodArea,
    showSubmit,
    submitDisabled,
  };
}
