"use client";

import HallAddressSelect from "@/components/owner-management/add-hall/HallAddressSelect";
import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import HallRegionSelect from "@/components/owner-management/add-hall/HallRegionSelect";
import { useHallCatalogs } from "@/hooks/useHallCatalogs";
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
  const { addressesFor } = useHallCatalogs();
  const regionError = resolveError(fieldErrors.region);
  const addressError = resolveError(fieldErrors.address);
  const detailedAddressError = resolveError(fieldErrors.detailedAddress);
  const catalogAddresses = addressesFor(values.region);
  const useAddressDropdown = Boolean(values.region) && catalogAddresses.length > 0;

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
            onChange={(region) => onChange({ region, address: "" })}
          />
        </HallFormField>

        <div className="md:col-span-1">
          <HallFormField
            id="hall-address"
            label={t("owner.management.addHall.fields.address")}
            required
            error={addressError}
            hint={t("owner.management.addHall.fields.addressHint")}
          >
            {useAddressDropdown ? (
              <HallAddressSelect
                id="hall-address"
                value={values.address}
                addresses={catalogAddresses}
                disabled={disabled}
                hasError={Boolean(addressError)}
                aria-invalid={addressError ? true : undefined}
                aria-describedby={
                  addressError ? "hall-address-error" : "hall-address-hint"
                }
                onChange={(address) => onChange({ address })}
              />
            ) : (
              <input
                id="hall-address"
                type="text"
                autoComplete="street-address"
                value={values.address}
                disabled={disabled || !values.region}
                aria-invalid={addressError ? true : undefined}
                aria-describedby={
                  addressError ? "hall-address-error" : "hall-address-hint"
                }
                onChange={(event) => onChange({ address: event.target.value })}
                className={hallFieldClassName(Boolean(addressError))}
              />
            )}
          </HallFormField>
        </div>

        <div className="md:col-span-2">
          <HallFormField
            id="hall-detailed-address"
            label={t("owner.management.addHall.fields.detailedAddress")}
            error={detailedAddressError}
            hint={t("owner.management.addHall.fields.detailedAddressHint")}
          >
            <textarea
              id="hall-detailed-address"
              rows={3}
              value={values.detailedAddress}
              disabled={disabled}
              aria-invalid={detailedAddressError ? true : undefined}
              aria-describedby={
                detailedAddressError
                  ? "hall-detailed-address-error"
                  : "hall-detailed-address-hint"
              }
              placeholder={t(
                "owner.management.addHall.fields.detailedAddressPlaceholder",
              )}
              onChange={(event) => onChange({ detailedAddress: event.target.value })}
              className={`${hallFieldClassName(Boolean(detailedAddressError))} min-h-[6.5rem] max-w-full resize-y break-words whitespace-pre-wrap`}
            />
          </HallFormField>
        </div>
      </div>
    </HallFormSection>
  );
}
