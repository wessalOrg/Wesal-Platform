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
      icon={<BasicInfoDocIcon />}
      className="h-full"
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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

function BasicInfoDocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M7 3.75h7.2L19 8.55V20.25a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20.25V5.25A1.5 1.5 0 0 1 7 3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 3.75V8.1H19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.5h7M8.5 16h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
