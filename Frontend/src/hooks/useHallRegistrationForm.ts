"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  hallRegistrationSubmitErrorMessage,
  isUnauthorizedApiError,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-registration-errors";
import { mapHallFormToCreateHallRequest } from "@/lib/hall-form-mapper";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { validateHallRegistrationForm } from "@/lib/hall-registration-validation";
import { createHall } from "@/services/hall-registration";
import { ApiError } from "@/lib/api-error";
import {
  EMPTY_HALL_REGISTRATION_VALUES,
  type HallRegistrationFieldErrors,
  type HallRegistrationFormValues,
  type HallRegistrationSubmitStatus,
} from "@/types/hall-registration";

type UseHallRegistrationFormOptions = {
  initiationId?: string | null;
};

export function useHallRegistrationForm(options: UseHallRegistrationFormOptions = {}) {
  const { logout } = useAuth();
  const [values, setValues] = useState<HallRegistrationFormValues>(
    EMPTY_HALL_REGISTRATION_VALUES,
  );
  const [fieldErrors, setFieldErrors] = useState<HallRegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<HallRegistrationSubmitStatus>("idle");
  const submittingRef = useRef(false);

  const clearFeedback = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    if (status === "success" || status === "error") {
      setStatus("idle");
    }
  }, [status]);

  const patchValues = useCallback(
    (patch: Partial<HallRegistrationFormValues>) => {
      setValues((current) => ({ ...current, ...patch }));
      if (Object.keys(fieldErrors).length || formError || status === "success") {
        setFieldErrors({});
        setFormError(null);
        if (status === "success" || status === "error") setStatus("idle");
      }
    },
    [fieldErrors, formError, status],
  );

  const setPeriod = useCallback(
    (
      which: "firstPeriod" | "secondPeriod",
      patch: Partial<HallRegistrationFormValues["firstPeriod"]>,
    ) => {
      setValues((current) => ({
        ...current,
        [which]: { ...current[which], ...patch },
      }));
      if (Object.keys(fieldErrors).length || formError || status === "success") {
        setFieldErrors({});
        setFormError(null);
        if (status === "success" || status === "error") setStatus("idle");
      }
    },
    [fieldErrors, formError, status],
  );

  const addPhotos = useCallback(
    (files: FileList | File[]) => {
      const next = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (next.length === 0) return;
      setValues((current) => ({
        ...current,
        photos: [...current.photos, ...next],
      }));
      if (fieldErrors.photos || formError || status === "success") {
        setFieldErrors((current) => {
          if (!current.photos) return current;
          const next = { ...current };
          delete next.photos;
          return next;
        });
        setFormError(null);
        if (status === "success" || status === "error") setStatus("idle");
      }
    },
    [fieldErrors.photos, formError, status],
  );

  const removePhoto = useCallback(
    (index: number) => {
      setValues((current) => ({
        ...current,
        photos: current.photos.filter((_, i) => i !== index),
      }));
      if (Object.keys(fieldErrors).length || formError || status === "success") {
        setFieldErrors({});
        setFormError(null);
        if (status === "success" || status === "error") setStatus("idle");
      }
    },
    [fieldErrors, formError, status],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) return false;

    const clientErrors = validateHallRegistrationForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setFormError("owner.management.addHall.errors.validation");
      setStatus("error");
      return false;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setFieldErrors({});
    setFormError(null);

    try {
      const formData = mapHallFormToCreateHallRequest(values, {
        initiationId: options.initiationId,
      });
      await createHall(formData);
      setStatus("success");
      setValues({
        ...EMPTY_HALL_REGISTRATION_VALUES,
        firstPeriod: { startTime: "", endTime: "" },
        secondPeriod: { startTime: "", endTime: "" },
        photos: [],
      });
      notifyHallOwnerHallsChanged();
      return true;
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        await logout({ redirect: false });
        setStatus("idle");
        return false;
      }

      if (err instanceof ApiError) {
        const mapped = mapHallApiErrorsToFormErrors(err);
        setFieldErrors(mapped);
        setFormError(hallRegistrationSubmitErrorMessage(err));
      } else {
        setFormError(hallRegistrationSubmitErrorMessage(err));
      }
      setStatus("error");
      return false;
    } finally {
      submittingRef.current = false;
    }
  }, [logout, options.initiationId, values]);

  return {
    values,
    fieldErrors,
    formError,
    status,
    isSubmitting: status === "submitting",
    isSuccess: status === "success",
    patchValues,
    setPeriod,
    addPhotos,
    removePhoto,
    submit,
    clearFeedback,
  };
}
