"use client";

import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import HallRegionSelect from "@/components/owner-management/add-hall/HallRegionSelect";
import { useT } from "@/i18n";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type HallLocationSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<HallRegistrationFormValues>) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

export default function HallLocationSection({
  values,
  fieldErrors,
  disabled,
  onChange,
  resolveError,
}: HallLocationSectionProps) {
  const t = useT();
  const regionError = resolveError(fieldErrors.region);
  const addressError = resolveError(fieldErrors.detailedAddress);

  return (
    <HallFormSection
      id="hall-location-heading"
      title={t("owner.management.addHall.sections.location")}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <HallFormField
          id="hall-region"
          label={t("owner.management.addHall.fields.region")}
          required
          error={regionError}
        >
          <HallRegionSelect
            id="hall-region"
            value={values.region}
            disabled={disabled}
            hasError={Boolean(regionError)}
            aria-invalid={regionError ? true : undefined}
            aria-describedby={regionError ? "hall-region-error" : undefined}
            onChange={(region) => onChange({ region })}
          />
        </HallFormField>

        <div className="md:col-span-2">
          <HallFormField
            id="hall-address"
            label={t("owner.management.addHall.fields.detailedAddress")}
            required
            error={addressError}
          >
            <textarea
              id="hall-address"
              rows={3}
              value={values.detailedAddress}
              disabled={disabled}
              aria-invalid={addressError ? true : undefined}
              aria-describedby={addressError ? "hall-address-error" : undefined}
              onChange={(event) =>
                onChange({ detailedAddress: event.target.value })
              }
              className={`${hallFieldClassName(Boolean(addressError))} min-h-[5.5rem] max-w-full resize-y break-words`}
            />
          </HallFormField>
        </div>
      </div>
    </HallFormSection>
  );
}
