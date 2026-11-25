"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { useHallImageSelection } from "@/hooks/useHallImageSelection";
import { formatHallImageIssues, HallImageValidationError, type HallImageIssue } from "@/lib/hall-image-validation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  hallRegistrationSubmitErrorMessage,
  isUnauthorizedApiError,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-registration-errors";
import { mapHallFormToCreateHallRequest } from "@/lib/hall-form-mapper";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { validateHallRegistrationForm } from "@/lib/hall-registration-validation";
import { emitHallCreated } from "@/lib/hall-review-events";
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
  const t = useT();
  const { scope, isCurrent } = useAuthenticatedRequestScope();
  const { select, cancelCover, isPending } = useHallImageSelection(scope, isCurrent);
  const [values, setValues] = useState<HallRegistrationFormValues>(
    EMPTY_HALL_REGISTRATION_VALUES,
  );
  const [fieldErrors, setFieldErrors] = useState<HallRegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<HallRegistrationSubmitStatus>("idle");
  const submittingRef = useRef(false);
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope); setValues({ ...EMPTY_HALL_REGISTRATION_VALUES, photos: [] });
    setFieldErrors({}); setFormError(null); setStatus("idle");
  }
  useLayoutEffect(() => { submittingRef.current = false; }, [scope]);

  const clearFeedback = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    if (status === "success" || status === "error") {
      setStatus("idle");
    }
  }, [status]);

  const imageFeedback = useCallback((field: "photos" | "mainPhoto", rejected: HallImageIssue[]) => {
    setFieldErrors(current => { const next = { ...current }; delete next[field];
      if (rejected.length) next[field] = formatHallImageIssues(rejected, t); return next; });
    setFormError(null);
    setStatus(current => current === "error" || current === "success" ? "idle" : current);
  }, [t]);

  const patchValues = useCallback((patch: Partial<HallRegistrationFormValues>) => {
    const { mainPhoto, ...rest } = patch;
    if (mainPhoto !== undefined) {
      if (submittingRef.current) return;
      if (mainPhoto === null) { cancelCover(); setValues(current => ({ ...current, mainPhoto: null })); imageFeedback("mainPhoto", []); }
      else void select([mainPhoto], true, result => {
        if (result.accepted[0]) setValues(current => ({ ...current, mainPhoto: result.accepted[0] }));
        imageFeedback("mainPhoto", result.rejected);
      });
    }
    if (Object.keys(rest).length) { setValues(current => ({ ...current, ...rest })); clearFeedback(); }
  }, [cancelCover, select, imageFeedback, clearFeedback]);

  const addPhotos = useCallback((files: FileList | File[]) => {
    if (submittingRef.current) return;
    void select(files, false, result => {
      if (result.accepted.length) setValues(current => ({ ...current, photos: [...current.photos, ...result.accepted] }));
      imageFeedback("photos", result.rejected);
    });
  }, [select, imageFeedback]);

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
    if (!isCurrent() || submittingRef.current) return false;
    if (isPending()) { setFormError("owner.hallImages.pending"); return false; }

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
      const created = await createHall(formData);
      if (!isCurrent()) return false;
      emitHallCreated({
        hallId: created.hallId,
        hallName: values.hallName.trim(),
      });
      setStatus("success");
      setValues({
        ...EMPTY_HALL_REGISTRATION_VALUES,
        photos: [],
      });
      notifyHallOwnerHallsChanged();
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      if (err instanceof HallImageValidationError) {
        setFieldErrors(Object.fromEntries(Object.entries(err.issues).map(([field, issues]) => [field, formatHallImageIssues(issues, t)])));
        setFormError("owner.management.addHall.errors.validation"); setStatus("error"); return false;
      }
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
      if (isCurrent()) submittingRef.current = false;
    }
  }, [logout, options.initiationId, values, isCurrent, isPending, t]);

  return {
    values,
    fieldErrors,
    formError,
    status,
    isSubmitting: status === "submitting",
    isSuccess: status === "success",
    patchValues,
    addPhotos,
    removePhoto,
    submit,
    clearFeedback,
  };
}
