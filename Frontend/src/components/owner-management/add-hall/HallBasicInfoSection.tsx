"use client";

import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type HallBasicInfoSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<HallRegistrationFormValues>) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

export default function HallBasicInfoSection({
  values,
  fieldErrors,
  disabled,
  onChange,
  resolveError,
}: HallBasicInfoSectionProps) {
  const t = useT();
  const nameError = resolveError(fieldErrors.hallName);
  const phoneError = resolveError(fieldErrors.ownerPhone);
  const capacityError = resolveError(fieldErrors.guestCapacity);
  const priceError = resolveError(fieldErrors.rentalPrice);

  return (
    <HallFormSection
      id="hall-basic-heading"
      title={t("owner.management.addHall.sections.basic")}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <HallFormField
            id="hall-name"
            label={t("owner.management.addHall.fields.hallName")}
            required
            error={nameError}
          >
            <input
              id="hall-name"
              type="text"
              value={values.hallName}
              disabled={disabled}
              autoComplete="organization"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "hall-name-error" : undefined}
              onChange={(event) => onChange({ hallName: event.target.value })}
              className={hallFieldClassName(Boolean(nameError))}
            />
          </HallFormField>
        </div>

        <div className="md:col-span-2">
          <HallFormField
            id="hall-phone"
            label={t("owner.management.addHall.fields.ownerPhone")}
            required
            error={phoneError}
          >
            <input
              id="hall-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={values.ownerPhone}
              disabled={disabled}
              autoComplete="tel"
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? "hall-phone-error" : undefined}
              onChange={(event) => onChange({ ownerPhone: event.target.value })}
              className={`${hallFieldClassName(Boolean(phoneError))} text-right`}
            />
          </HallFormField>
        </div>

        <HallFormField
          id="hall-capacity"
          label={t("owner.management.addHall.fields.guestCapacity")}
          required
          error={capacityError}
        >
          <input
            id="hall-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.guestCapacity}
            disabled={disabled}
            aria-invalid={capacityError ? true : undefined}
            aria-describedby={capacityError ? "hall-capacity-error" : undefined}
            onChange={(event) => onChange({ guestCapacity: event.target.value })}
            className={hallFieldClassName(Boolean(capacityError))}
          />
        </HallFormField>

        <HallFormField
          id="hall-price"
          label={t("owner.management.addHall.fields.rentalPrice")}
          error={priceError}
          hint={t("owner.management.addHall.fields.rentalPriceHint")}
        >
          <input
            id="hall-price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={values.rentalPrice}
            disabled={disabled}
            aria-invalid={priceError ? true : undefined}
            aria-describedby={
              priceError ? "hall-price-error" : "hall-price-hint"
            }
            onChange={(event) => onChange({ rentalPrice: event.target.value })}
            className={hallFieldClassName(Boolean(priceError))}
          />
        </HallFormField>
      </div>
    </HallFormSection>
  );
}
