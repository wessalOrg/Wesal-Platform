import { isFutureBookingDate } from "@/lib/booking-date";
import { uniquePeriods } from "@/lib/booking-period";
import type { BookingError } from "@/lib/booking-errors";
import type { BookingPeriodType, BookingRequestInput } from "@/types/booking";
import type { HallDayPeriod } from "@/types/hall";

export type BookingValidationIssue = {
  messageKey: string;
  fields?: { date?: string; periods?: string };
};

export type BookingDraft = {
  dateIso: string | null;
  periods: BookingPeriodType[];
};

export function validateBookingDraft(
  draft: BookingDraft,
  periods: HallDayPeriod[],
): BookingValidationIssue | null {
  if (!draft.dateIso) {
    return {
      messageKey: "halls.booking.pickDateFirst",
      fields: { date: "halls.booking.pickDateFirst" },
    };
  }

  if (!isFutureBookingDate(draft.dateIso)) {
    return {
      messageKey: "errors.booking.dateFuture",
      fields: { date: "errors.booking.dateFuture" },
    };
  }

  const selected = uniquePeriods(draft.periods);
  if (selected.length === 0) {
    return {
      messageKey: "errors.booking.periodRequired",
      fields: { periods: "errors.booking.periodRequired" },
    };
  }

  for (const type of selected) {
    const period = periods.find((item) => item.periodType === type);
    if (!period) {
      return {
        messageKey: "errors.booking.periodUnavailable",
        fields: { periods: "errors.booking.periodUnavailable" },
      };
    }
    if (period.status === "booked") {
      return {
        messageKey: "errors.booking.periodBooked",
        fields: { periods: "errors.booking.periodBooked" },
      };
    }
  }

  return null;
}

export function buildBookingRequest(
  hallId: string,
  dateIso: string,
  periods: BookingPeriodType[],
): BookingRequestInput {
  return {
    hallId,
    date: dateIso,
    periods: uniquePeriods(periods),
  };
}

export function dropBookedSelections(
  selected: BookingPeriodType[],
  periods: HallDayPeriod[],
): BookingPeriodType[] {
  return selected.filter((type) => {
    const period = periods.find((item) => item.periodType === type);
    return Boolean(period && period.status !== "booked" && period.periodType);
  });
}

export type ConflictResolution = {
  selected: BookingPeriodType[];
  messageKey: string;
};

/** Keep the date; unselect periods that are no longer available. */
export function resolveAvailabilityConflict(
  selected: BookingPeriodType[],
  periods: HallDayPeriod[],
  error?: BookingError | null,
): ConflictResolution {
  return {
    selected: dropBookedSelections(selected, periods),
    messageKey: error?.kind === "conflict" ? "errors.booking.conflict" : "errors.booking.generic",
  };
}
