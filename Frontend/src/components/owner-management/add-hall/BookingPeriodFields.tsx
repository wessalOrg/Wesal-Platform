"use client";

import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import { useT } from "@/i18n";
import type { BookingPeriodFormValues } from "@/types/hall-registration";

type BookingPeriodFieldsProps = {
  idPrefix: string;
  title: string;
  values: BookingPeriodFormValues;
  startError?: string;
  endError?: string;
  periodError?: string;
  disabled: boolean;
  onChange: (patch: Partial<BookingPeriodFormValues>) => void;
};

export default function BookingPeriodFields({
  idPrefix,
  title,
  values,
  startError,
  endError,
  periodError,
  disabled,
  onChange,
}: BookingPeriodFieldsProps) {
  const t = useT();
  const startId = `${idPrefix}-start`;
  const endId = `${idPrefix}-end`;
  const hasError = Boolean(startError || endError || periodError);
  const timePlaceholder = t("owner.management.addHall.fields.periodTimePlaceholder");

  return (
    <fieldset
      className={`owner-add-hall-period min-w-0 max-w-full overflow-visible rounded-xl border p-3.5 sm:p-4 ${
        hasError
          ? "border-[#c45b55] bg-[#fff8f7]"
          : "border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]/50"
      }`}
      data-invalid={hasError || undefined}
    >
      <legend className="max-w-full break-words px-1 text-sm font-bold text-[var(--wesal-maroon)]">
        {title}
        <span className="ms-1 text-[#c45b55]" aria-hidden="true">
          *
        </span>
      </legend>

      {periodError ? (
        <p role="alert" className="mb-3 break-words text-xs leading-5 text-[#c45b55]">
          {periodError}
        </p>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <HallFormField
          id={startId}
          label={t("owner.management.addHall.fields.periodStart")}
          required
          error={startError}
        >
          <input
            id={startId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={timePlaceholder}
            value={values.startTime}
            disabled={disabled}
            aria-invalid={startError ? true : undefined}
            aria-describedby={startError ? `${startId}-error` : undefined}
            className={hallFieldClassName(Boolean(startError))}
            dir="ltr"
            onChange={(event) => onChange({ startTime: event.target.value })}
          />
        </HallFormField>

        <HallFormField
          id={endId}
          label={t("owner.management.addHall.fields.periodEnd")}
          required
          error={endError}
        >
          <input
            id={endId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={timePlaceholder}
            value={values.endTime}
            disabled={disabled}
            aria-invalid={endError ? true : undefined}
            aria-describedby={endError ? `${endId}-error` : undefined}
            className={hallFieldClassName(Boolean(endError))}
            dir="ltr"
            onChange={(event) => onChange({ endTime: event.target.value })}
          />
        </HallFormField>
      </div>
    </fieldset>
  );
}
