"use client";

import { type FormEvent, useEffect } from "react";
import OwnerHourlyControls from "@/components/halls/hourly/OwnerHourlyControls";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import HallBasicInfoSection from "@/components/owner-management/add-hall/HallBasicInfoSection";
import HallFeaturesSection from "@/components/owner-management/add-hall/HallFeaturesSection";
import HallFormActions from "@/components/owner-management/add-hall/HallFormActions";
import HallLocationSection from "@/components/owner-management/add-hall/HallLocationSection";
import HallMediaSection from "@/components/owner-management/add-hall/HallMediaSection";
import HallEditabilityNotice from "@/components/owner-management/halls/HallEditabilityNotice";
import HallManagementPhotosSection from "@/components/owner-management/halls/HallManagementPhotosSection";
import { useT } from "@/i18n";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import type {
  HallEditFieldErrors,
  HallEditFormValues,
  HallEditability,
} from "@/types/hall-owner-hall-management";
import type {
  HallRegistrationFieldPath,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type HallManagementFormProps = {
  hallId: string;
  values: HallEditFormValues;
  fieldErrors: HallEditFieldErrors;
  formError: string | null;
  editability: HallEditability;
  isSubmitting: boolean;
  isSuccess: boolean;
  controlsDisabled: boolean;
  paymentStatus?: HallPaymentStatus;
  onPatch: (patch: Partial<HallEditFormValues>) => void;
  onRemoveExistingPhoto: (photoId: string) => void;
  onSetCover: (url: string) => void;
  onAddNewPhotos: (files: FileList | File[]) => void;
  onRemoveNewPhoto: (index: number) => void;
  onSubmit: () => void;
  successMessage?: string;
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

const FIELD_FOCUS_ID: Record<HallRegistrationFieldPath, string> = {
  hallName: "hall-name",
  ownerPhone: "hall-phone",
  region: "hall-region",
  address: "hall-address",
  detailedAddress: "hall-detailed-address",
  description: "hall-description",
  guestCapacity: "hall-capacity",
  rentalPrice: "hall-price",
  youtubeVideoUrl: "hall-youtube",
  features: "hall-features",
  otherFeatures: "hall-other-features",
  mainPhoto: "hall-main-photo",
  photos: "hall-mgmt-photos-add",
};

const FIELD_FOCUS_ORDER: HallRegistrationFieldPath[] = [
  "hallName",
  "ownerPhone",
  "guestCapacity",
  "rentalPrice",
  "region",
  "address",
  "detailedAddress",
  "description",
  "features",
  "otherFeatures",
  "youtubeVideoUrl",
  "mainPhoto",
  "photos",
];

function toSectionValues(values: HallEditFormValues): HallRegistrationFormValues {
  return {
    hallName: values.hallName,
    ownerPhone: values.ownerPhone,
    region: values.region,
    address: values.address,
    detailedAddress: values.detailedAddress,
    description: values.description,
    guestCapacity: values.guestCapacity,
    rentalPrice: values.rentalPrice,
    youtubeVideoUrl: values.youtubeVideoUrl,
    features: values.features,
    otherFeatures: values.otherFeatures,
    photos: values.photos,
    mainPhoto: values.mainPhoto,
  };
}

function interactionState(
  isSubmitting: boolean,
  isSuccess: boolean,
  hasFieldErrors: boolean,
  formError: string | null,
  editability: HallEditability,
): string {
  if (editability === "locked") return editability;
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
  hallId,
  values,
  fieldErrors,
  formError,
  editability,
  isSubmitting,
  isSuccess,
  controlsDisabled,
  paymentStatus,
  onPatch,
  onRemoveExistingPhoto,
  onSetCover,
  onAddNewPhotos,
  onRemoveNewPhoto,
  onSubmit,
  successMessage,
}: HallManagementFormProps) {
  const t = useT();
  const resolveError = (value: string | undefined) => resolveMessage(t, value);
  const sectionValues = toSectionValues(values);
  const canSubmit = editability !== "locked";
  const state = interactionState(
    isSubmitting,
    isSuccess,
    Object.keys(fieldErrors).length > 0,
    formError,
    editability,
  );

  useEffect(() => {
    const field = FIELD_FOCUS_ORDER.find((key) => fieldErrors[key]);
    if (!field) return;
    const node = document.getElementById(FIELD_FOCUS_ID[field]);
    node?.focus();
    node?.scrollIntoView({ block: "center" });
  }, [fieldErrors]);

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

        <HallFeaturesSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChange={(patch) => onPatch(patch)}
          resolveError={resolveError}
        />

        <HallMediaSection
          values={sectionValues}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onChange={(patch) => onPatch(patch)}
          resolveError={resolveError}
          currentCoverUrl={values.coverPhotoUrl}
        />

        <HallManagementPhotosSection
          existingPhotos={values.existingPhotos}
          newPhotos={values.photos}
          coverPhotoUrl={values.coverPhotoUrl}
          fieldErrors={fieldErrors}
          disabled={controlsDisabled}
          onRemoveExisting={onRemoveExistingPhoto}
          onSetCover={onSetCover}
          onAddNew={onAddNewPhotos}
          onRemoveNew={onRemoveNewPhoto}
          resolveError={resolveError}
        />

        <HallFormSection
          id="hall-hourly-settings-heading"
          title={t("owner.hourly.title")}
          description={t("owner.hourly.settingsHint")}
        >
          <OwnerHourlyControls
            hallId={hallId}
            disabled={controlsDisabled}
            paymentStatus={paymentStatus}
          />
        </HallFormSection>
      </div>

      <HallFormActions
        isSubmitting={isSubmitting}
        formError={formError}
        isSuccess={isSuccess}
        resolveMessage={(value) => resolveMessage(t, value) ?? null}
        submitLabel={t("owner.management.hallEdit.actions.save")}
        savingLabel={t("owner.management.hallEdit.actions.saving")}
        successMessage={successMessage ?? t("owner.management.hallEdit.success")}
        submitDisabled={!canSubmit}
        submitTestId="owner-hall-edit-submit"
        successTestId="owner-hall-edit-success"
        errorTestId="owner-hall-edit-form-error"
      />
    </form>
  );
}
