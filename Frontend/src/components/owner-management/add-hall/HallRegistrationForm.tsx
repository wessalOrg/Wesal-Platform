"use client";

import { type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import BookingPeriodsSection from "@/components/owner-management/add-hall/BookingPeriodsSection";
import HallBasicInfoSection from "@/components/owner-management/add-hall/HallBasicInfoSection";
import HallDescriptionSection from "@/components/owner-management/add-hall/HallDescriptionSection";
import HallFormActions from "@/components/owner-management/add-hall/HallFormActions";
import HallLocationSection from "@/components/owner-management/add-hall/HallLocationSection";
import HallPhotosSection from "@/components/owner-management/add-hall/HallPhotosSection";
import { useHallRegistrationForm } from "@/hooks/useHallRegistrationForm";
import { useT } from "@/i18n";

function resolveMessage(
  t: (key: string) => string,
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return value.startsWith("owner.") || value.startsWith("errors.")
    ? t(value)
    : value;
}

function interactionState(
  isSubmitting: boolean,
  isSuccess: boolean,
  hasFieldErrors: boolean,
  formError: string | null,
): "idle" | "submitting" | "validationError" | "submissionError" | "success" {
  if (isSubmitting) return "submitting";
  if (isSuccess) return "success";
  if (hasFieldErrors) return "validationError";
  if (formError) return "submissionError";
  return "idle";
}

export default function HallRegistrationForm() {
  const t = useT();
  const searchParams = useSearchParams();
  const initiationId = searchParams.get("initiationId");

  const {
    values,
    fieldErrors,
    formError,
    isSubmitting,
    isSuccess,
    patchValues,
    setPeriod,
    addPhotos,
    removePhoto,
    submit,
  } = useHallRegistrationForm({ initiationId });

  const resolveError = (value: string | undefined) => resolveMessage(t, value);
  const state = interactionState(
    isSubmitting,
    isSuccess,
    Object.keys(fieldErrors).length > 0,
    formError,
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    void submit();
  };

  return (
    <form
      className="owner-add-hall-form min-w-0 max-w-full space-y-[1.1rem]"
      data-testid="owner-add-hall-form"
      data-state={state}
      aria-busy={isSubmitting || undefined}
      noValidate
      onSubmit={onSubmit}
    >
      <div
        className={`min-w-0 max-w-full space-y-[1.1rem] ${
          isSubmitting ? "pointer-events-none opacity-[0.92]" : ""
        }`}
      >
        <HallBasicInfoSection
          values={values}
          fieldErrors={fieldErrors}
          disabled={isSubmitting}
          onChange={patchValues}
          resolveError={resolveError}
        />

        <HallLocationSection
          values={values}
          fieldErrors={fieldErrors}
          disabled={isSubmitting}
          onChange={patchValues}
          resolveError={resolveError}
        />

        <HallDescriptionSection
          values={values}
          fieldErrors={fieldErrors}
          disabled={isSubmitting}
          onChange={patchValues}
          resolveError={resolveError}
        />

        <HallPhotosSection
          photos={values.photos}
          fieldErrors={fieldErrors}
          disabled={isSubmitting}
          onAdd={addPhotos}
          onRemove={removePhoto}
          resolveError={resolveError}
        />

        <BookingPeriodsSection
          values={values}
          fieldErrors={fieldErrors}
          disabled={isSubmitting}
          onChangePeriod={setPeriod}
          resolveError={resolveError}
        />
      </div>

      <HallFormActions
        isSubmitting={isSubmitting}
        formError={formError}
        isSuccess={isSuccess}
        resolveMessage={(value) => resolveMessage(t, value) ?? null}
      />
    </form>
  );
}
