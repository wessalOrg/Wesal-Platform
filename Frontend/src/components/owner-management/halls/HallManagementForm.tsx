"use client";

import { type FormEvent } from "react";
import BookingPeriodsSection from "@/components/owner-management/add-hall/BookingPeriodsSection";
import HallBasicInfoSection from "@/components/owner-management/add-hall/HallBasicInfoSection";
import HallDescriptionSection from "@/components/owner-management/add-hall/HallDescriptionSection";
import HallFormActions from "@/components/owner-management/add-hall/HallFormActions";
import HallLocationSection from "@/components/owner-management/add-hall/HallLocationSection";
import HallEditabilityNotice from "@/components/owner-management/halls/HallEditabilityNotice";
import HallManagementPhotosSection from "@/components/owner-management/halls/HallManagementPhotosSection";
import { useT } from "@/i18n";
import type {
  HallEditFieldErrors,
  HallEditFormValues,
  HallEditability,
} from "@/types/hall-owner-hall-management";
import type { HallRegistrationFormValues } from "@/types/hall-registration";

type HallManagementFormProps = {
  values: HallEditFormValues;
  fieldErrors: HallEditFieldErrors;
  formError: string | null;
  editability: HallEditability;
  isSubmitting: boolean;
  isSuccess: boolean;
  controlsDisabled: boolean;
  onPatch: (patch: Partial<HallEditFormValues>) => void;
  onChangePeriod: (
    which: "firstPeriod" | "secondPeriod",
    patch: Partial<HallEditFormValues["firstPeriod"]>,
  ) => void;
  onRemoveExistingPhoto: (photoId: string) => void;
  onSubmit: () => void;
};

function resolveMessage(
  t: (key: string) => string,
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return value.startsWith("owner.") || value.startsWith("errors.")
    ? t(value)
    : value;
}

function toSectionValues(values: HallEditFormValues): HallRegistrationFormValues {
  return {
    hallName: values.hallName,
    ownerPhone: values.ownerPhone,
    region: values.region,
    detailedAddress: values.detailedAddress,
    description: values.description,
    guestCapacity: values.guestCapacity,
    rentalPrice: values.rentalPrice,
    firstPeriod: values.firstPeriod,
    secondPeriod: values.secondPeriod,
    photos: [],
  };
}

function interactionState(
  isSubmitting: boolean,
  isSuccess: boolean,
  hasFieldErrors: boolean,
  formError: string | null,
  editability: HallEditability,
): string {
  if (editability !== "editable") return editability;
  if (isSubmitting) return "submitting";
  if (isSuccess) return "success";
  if (hasFieldErrors) return "validationError";
  if (formError) return "submissionError";
  return "idle";
}

/**
 * Presentational edit form — reuses US-OWNER-04 sections; photos are management-specific.
 */
export default function HallManagementForm({
  values,
  fieldErrors,
  formError,
  editability,
  isSubmitting,
  isSuccess,
  controlsDisabled,
  onPatch,
  onChangePeriod,
  onRemoveExistingPhoto,
  onSubmit,
}: HallManagementFormProps) {
  const t = useT();
  const resolveError = (value: string | undefined) => resolveMessage(t, value);
  const sectionValues = toSectionValues(values);
  const canSubmit = editability === "editable";
  const state = interactionState(
    isSubmitting,
    isSuccess,
    Object.keys(fieldErrors).length > 0,
    formError,
    editability,
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !canSubmit) return;
    onSubmit();
  };

  return (
    <form
      className="owner-add-hall-form owner-hall-mgmt-form min-w-0 max-w-full space-y-6 sm:space-y-8"
      data-testid="owner-hall-management-form"
      data-state={state}
      aria-busy={isSubmitting || undefined}
      noValidate
      onSubmit={handleSubmit}
    >
      <HallEditabilityNotice editability={editability} />

      <div
        className={`min-w-0 max-w-full space-y-6 sm:space-y-8 ${
          isSubmitting ? "pointer-events-none opacity-[0.92]" : ""
        }`}
      >
        <HallBasicInfoSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChange={(patch) => onPatch(patch)}
          resolveError={resolveError}
        />

        <HallLocationSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChange={(patch) => onPatch(patch)}
          resolveError={resolveError}
        />

        <HallDescriptionSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChange={(patch) => onPatch(patch)}
          resolveError={resolveError}
        />

        <HallManagementPhotosSection
          existingPhotos={values.existingPhotos}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onRemoveExisting={onRemoveExistingPhoto}
          resolveError={resolveError}
        />

        <BookingPeriodsSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChangePeriod={onChangePeriod}
          resolveError={resolveError}
        />
      </div>

      <HallFormActions
        isSubmitting={isSubmitting}
        formError={formError}
        isSuccess={isSuccess}
        resolveMessage={(value) => resolveMessage(t, value) ?? null}
        submitLabel={t("owner.management.hallEdit.actions.save")}
        savingLabel={t("owner.management.hallEdit.actions.saving")}
        successMessage={t("owner.management.hallEdit.success")}
        submitDisabled={!canSubmit}
        submitTestId="owner-hall-edit-submit"
        successTestId="owner-hall-edit-success"
        errorTestId="owner-hall-edit-form-error"
      />
    </form>
  );
}
