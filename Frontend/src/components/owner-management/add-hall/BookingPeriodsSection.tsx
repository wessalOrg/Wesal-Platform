"use client";

import BookingPeriodFields from "@/components/owner-management/add-hall/BookingPeriodFields";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type {
  BookingPeriodFormValues,
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type BookingPeriodsSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChangePeriod: (
    which: "firstPeriod" | "secondPeriod",
    patch: Partial<BookingPeriodFormValues>,
  ) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

export default function BookingPeriodsSection({
  values,
  fieldErrors,
  disabled,
  onChangePeriod,
  resolveError,
}: BookingPeriodsSectionProps) {
  const t = useT();

  return (
    <HallFormSection
      id="hall-periods-heading"
      title={t("owner.management.addHall.sections.periods")}
      description={t("owner.management.addHall.sections.periodsHint")}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <BookingPeriodFields
          idPrefix="first-period"
          title={t("owner.management.addHall.fields.firstPeriod")}
          values={values.firstPeriod}
          startError={resolveError(fieldErrors["firstPeriod.startTime"])}
          endError={resolveError(fieldErrors["firstPeriod.endTime"])}
          periodError={resolveError(fieldErrors.firstPeriod)}
          disabled={disabled}
          onChange={(patch) => onChangePeriod("firstPeriod", patch)}
        />

        <BookingPeriodFields
          idPrefix="second-period"
          title={t("owner.management.addHall.fields.secondPeriod")}
          values={values.secondPeriod}
          startError={resolveError(fieldErrors["secondPeriod.startTime"])}
          endError={resolveError(fieldErrors["secondPeriod.endTime"])}
          periodError={resolveError(fieldErrors.secondPeriod)}
          disabled={disabled}
          onChange={(patch) => onChangePeriod("secondPeriod", patch)}
        />
      </div>
    </HallFormSection>
  );
}
