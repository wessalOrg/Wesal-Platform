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

type HallDescriptionSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<HallRegistrationFormValues>) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

export default function HallDescriptionSection({
  values,
  fieldErrors,
  disabled,
  onChange,
  resolveError,
}: HallDescriptionSectionProps) {
  const t = useT();
  const descriptionError = resolveError(fieldErrors.description);

  return (
    <HallFormSection
      id="hall-description-heading"
      title={t("owner.management.addHall.sections.description")}
    >
      <HallFormField
        id="hall-description"
        label={t("owner.management.addHall.fields.description")}
        required
        error={descriptionError}
      >
        <textarea
          id="hall-description"
          rows={5}
          value={values.description}
          disabled={disabled}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError ? "hall-description-error" : undefined}
          onChange={(event) => onChange({ description: event.target.value })}
          className={`${hallFieldClassName(Boolean(descriptionError))} min-h-[8rem] max-w-full resize-y break-words whitespace-pre-wrap`}
        />
      </HallFormField>
    </HallFormSection>
  );
}
