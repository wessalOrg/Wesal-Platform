"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";
import {
  hallUpdateSubmitErrorMessage,
  isHallNotEditableApiError,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-owner-hall-edit-errors";
import { validateHallEditForm } from "@/lib/hall-owner-hall-edit-validation";
import { mapHallDetailsToEditForm } from "@/lib/hall-owner-hall-management-mapper";
import { mapHallFormToUpdateHallRequest } from "@/lib/hall-owner-hall-update-mapper";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import {
  fetchOwnerHallDetails,
  updateOwnerHall,
} from "@/services/hall-owner-hall-management";
import type {
  HallDetailsLoadStatus,
  HallEditFieldErrors,
  HallEditFormValues,
  HallEditSubmitStatus,
  HallOwnerHallDetails,
} from "@/types/hall-owner-hall-management";

/**
 * Hall-ID-scoped details + edit state (US-OWNER-07 / US-OWNER-08).
 * Switching hallId clears previous Hall data before the next fetch settles.
 */
export function useHallOwnerHallManagement(hallId: string) {
  const { logout } = useAuth();

  const [boundHallId, setBoundHallId] = useState(hallId);
  const [details, setDetails] = useState<HallOwnerHallDetails | null>(null);
  const [loadStatus, setLoadStatus] = useState<HallDetailsLoadStatus>("loading");
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);

  const [values, setValues] = useState<HallEditFormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HallEditFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] =
    useState<HallEditSubmitStatus>("idle");

  const submittingRef = useRef(false);
  const loadGenerationRef = useRef(0);

  // Reset synchronously when selected Hall changes — prevents Hall A draft/UI on Hall B.
  if (hallId !== boundHallId) {
    setBoundHallId(hallId);
    setDetails(null);
    setValues(null);
    setFieldErrors({});
    setFormError(null);
    setSubmitStatus("idle");
    setLoadErrorKey(null);
    setLoadStatus("loading");
    submittingRef.current = false;
  }

  const hydrateFromDetails = useCallback((next: HallOwnerHallDetails) => {
    setDetails(next);
    setValues(mapHallDetailsToEditForm(next));
    setFieldErrors({});
    setFormError(null);
    setSubmitStatus("idle");
  }, []);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    const requestHallId = hallId;
    setLoadStatus("loading");
    setLoadErrorKey(null);

    try {
      // Hall-scoped fetch boundary: hallOwnerQueryKeys.hallDetails(hallId)
      const next = await fetchOwnerHallDetails(requestHallId);
      if (generation !== loadGenerationRef.current) return;
      if (next.id !== requestHallId) return;
      hydrateFromDetails(next);
      setLoadStatus("ready");
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      if (isUnauthorizedApiError(err)) {
        await logout({ redirect: false });
        setDetails(null);
        setValues(null);
        setLoadStatus("idle");
        return;
      }
      setDetails(null);
      setValues(null);
      setLoadErrorKey(
        err instanceof ApiError && err.status === 0
          ? "owner.management.hallEdit.errors.network"
          : err instanceof ApiError && err.status === 404
            ? "owner.management.hallEdit.errors.notFound"
            : "owner.management.hallEdit.errors.loadFailed",
      );
      setLoadStatus("error");
    }
  }, [hallId, hydrateFromDetails, logout]);

  useEffect(() => {
    void load();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [load]);

  const detailsMatchSelection = details?.id === hallId;
  const canEdit =
    detailsMatchSelection && details?.editability === "editable";
  const controlsDisabled =
    !canEdit ||
    submitStatus === "submitting" ||
    loadStatus !== "ready" ||
    !detailsMatchSelection;

  const clearFeedback = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    if (submitStatus === "success" || submitStatus === "error") {
      setSubmitStatus("idle");
    }
  }, [submitStatus]);

  const patchValues = useCallback(
    (patch: Partial<HallEditFormValues>) => {
      setValues((current) => (current ? { ...current, ...patch } : current));
      if (
        Object.keys(fieldErrors).length ||
        formError ||
        submitStatus === "success"
      ) {
        clearFeedback();
      }
    },
    [clearFeedback, fieldErrors, formError, submitStatus],
  );

  const setPeriod = useCallback(
    (
      which: "firstPeriod" | "secondPeriod",
      patch: Partial<HallEditFormValues["firstPeriod"]>,
    ) => {
      setValues((current) =>
        current
          ? { ...current, [which]: { ...current[which], ...patch } }
          : current,
      );
      if (
        Object.keys(fieldErrors).length ||
        formError ||
        submitStatus === "success"
      ) {
        clearFeedback();
      }
    },
    [clearFeedback, fieldErrors, formError, submitStatus],
  );

  const removeExistingPhoto = useCallback(
    (photoId: string) => {
      setValues((current) =>
        current
          ? {
              ...current,
              existingPhotos: current.existingPhotos.filter(
                (photo) => photo.id !== photoId,
              ),
            }
          : current,
      );
      clearFeedback();
    },
    [clearFeedback],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) return false;
    if (!values || !details) return false;
    // Never submit Hall A payload against Hall B route.
    if (details.id !== hallId) return false;
    if (details.editability !== "editable") {
      setFormError("owner.management.hallEdit.errors.notEditable");
      setSubmitStatus("error");
      return false;
    }

    const clientErrors = validateHallEditForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setFormError("owner.management.addHall.errors.validation");
      setSubmitStatus("error");
      return false;
    }

    submittingRef.current = true;
    setSubmitStatus("submitting");
    setFieldErrors({});
    setFormError(null);

    const targetHallId = hallId;
    const submitGeneration = loadGenerationRef.current;
    const isSubmitStale = () =>
      submitGeneration !== loadGenerationRef.current || targetHallId !== hallId;

    try {
      const body = mapHallFormToUpdateHallRequest(values);
      const updated = await updateOwnerHall(targetHallId, body);
      if (isSubmitStale()) return false;

      if (updated) {
        if (updated.id !== targetHallId) return false;
        hydrateFromDetails(updated);
      } else {
        const refreshed = await fetchOwnerHallDetails(targetHallId);
        if (isSubmitStale() || refreshed.id !== targetHallId) return false;
        hydrateFromDetails(refreshed);
      }

      if (isSubmitStale()) return false;
      setSubmitStatus("success");
      notifyHallOwnerHallsChanged();
      notifyPublicHallsChanged();
      return true;
    } catch (err) {
      if (isSubmitStale()) return false;

      if (isUnauthorizedApiError(err)) {
        await logout({ redirect: false });
        setSubmitStatus("idle");
        return false;
      }

      if (isHallNotEditableApiError(err)) {
        setFormError("owner.management.hallEdit.errors.notEditable");
        try {
          const refreshed = await fetchOwnerHallDetails(targetHallId);
          if (!isSubmitStale() && refreshed.id === targetHallId) {
            hydrateFromDetails(refreshed);
          }
        } catch {
          // keep entered values
        }
        if (!isSubmitStale()) setSubmitStatus("error");
        return false;
      }

      if (err instanceof ApiError) {
        setFieldErrors(mapHallApiErrorsToFormErrors(err));
        setFormError(hallUpdateSubmitErrorMessage(err));
      } else {
        setFormError(hallUpdateSubmitErrorMessage(err));
      }
      setSubmitStatus("error");
      return false;
    } finally {
      submittingRef.current = false;
    }
  }, [details, hallId, hydrateFromDetails, logout, values]);

  const isStaleSelection = Boolean(details && details.id !== hallId);

  return {
    hallId,
    details: detailsMatchSelection ? details : null,
    values: detailsMatchSelection ? values : null,
    fieldErrors,
    formError,
    loadStatus,
    loadErrorKey,
    submitStatus,
    isLoading: loadStatus === "loading" || isStaleSelection,
    isLoadError: loadStatus === "error" && !isStaleSelection,
    isSubmitting: submitStatus === "submitting",
    isSuccess: submitStatus === "success" && detailsMatchSelection,
    canEdit,
    controlsDisabled,
    reload: load,
    patchValues,
    setPeriod,
    removeExistingPhoto,
    submit,
  };
}
