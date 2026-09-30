"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError, isForbiddenApiError, isUnauthorizedApiError } from "@/lib/api-error";
import {
  hallUpdateSubmitErrorMessage,
  isHallNotEditableApiError,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-owner-hall-edit-errors";
import { validateHallEditForm } from "@/lib/hall-owner-hall-edit-validation";
import { mapHallDetailsToEditForm } from "@/lib/hall-owner-hall-management-mapper";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { isPaymentRequiredApiError } from "@/lib/payment-required-error";
import { isHallLockedApiError } from "@/lib/hall-locked-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import {
  fetchOwnerHallDetails,
  updateOwnerHall,
} from "@/services/hall-owner-hall-management";
import {
  reportOwnedHallAdminLocked,
  reportOwnedHallPaymentRequired,
  reportOwnedHallSystemLocked,
} from "@/hooks/useHallOwnerHalls";
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
export function useHallOwnerHallManagement(hallId: string, enabled = true) {
  const { logout } = useAuth();

  const [boundHallId, setBoundHallId] = useState(hallId);
  const [boundEnabled, setBoundEnabled] = useState(enabled);
  const [details, setDetails] = useState<HallOwnerHallDetails | null>(null);
  const [loadStatus, setLoadStatus] = useState<HallDetailsLoadStatus>(
    enabled ? "loading" : "idle",
  );
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);

  const [values, setValues] = useState<HallEditFormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HallEditFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] =
    useState<HallEditSubmitStatus>("idle");
  const [resubmitted, setResubmitted] = useState(false);

  const submittingRef = useRef(false);
  const loadGenerationRef = useRef(0);

  // Reset synchronously when selected Hall changes — prevents Hall A draft/UI on Hall B.
  if (hallId !== boundHallId || enabled !== boundEnabled) {
    setBoundHallId(hallId);
    setBoundEnabled(enabled);
    setDetails(null);
    setValues(null);
    setFieldErrors({});
    setFormError(null);
    setSubmitStatus("idle");
    setResubmitted(false);
    setLoadErrorKey(null);
    setLoadStatus(enabled ? "loading" : "idle");
  }

  const hydrateFromDetails = useCallback((next: HallOwnerHallDetails) => {
    setDetails(next);
    setValues(mapHallDetailsToEditForm(next));
    setFieldErrors({});
    setFormError(null);
    setSubmitStatus("idle");
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    const generation = ++loadGenerationRef.current;
    const requestHallId = hallId;
    setLoadStatus("loading");
    setLoadErrorKey(null);

    try {
      // Hall-scoped fetch boundary: one in-flight load per hallId (generation-guarded).
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
      if (isPaymentRequiredApiError(err)) {
        setDetails(null);
        setValues(null);
        setLoadErrorKey(null);
        setLoadStatus("payment_required");
        reportOwnedHallPaymentRequired(requestHallId);
        return;
      }
      if (isHallLockedApiError(err)) {
        setDetails(null);
        setValues(null);
        setLoadErrorKey(null);
        setLoadStatus("admin_locked");
        reportOwnedHallAdminLocked(requestHallId);
        return;
      }
      if (isSystemLockedApiError(err)) {
        setDetails(null);
        setValues(null);
        setLoadErrorKey(null);
        setLoadStatus("system_locked");
        reportOwnedHallSystemLocked(requestHallId);
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
  }, [enabled, hallId, hydrateFromDetails, logout]);

  useEffect(() => {
    submittingRef.current = false;
  }, [hallId, enabled]);

  useEffect(() => {
    if (!enabled) {
      loadGenerationRef.current += 1;
      return;
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      loadGenerationRef.current += 1;
    };
  }, [enabled, load]);

  const detailsMatchSelection = details?.id === hallId;
  const canEdit =
    detailsMatchSelection && details?.editability !== "locked";
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
    setResubmitted(false);
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

  const removeExistingPhoto = useCallback(
    (photoId: string) => {
      setValues((current) => {
        if (!current) return current;
        const removed = current.existingPhotos.find((photo) => photo.id === photoId);
        const existingPhotos = current.existingPhotos.filter(
          (photo) => photo.id !== photoId,
        );
        const coverRemoved = Boolean(
          removed && current.coverPhotoUrl === removed.url,
        );
        return {
          ...current,
          existingPhotos,
          coverPhotoUrl: coverRemoved
            ? (existingPhotos[0]?.url ?? null)
            : current.coverPhotoUrl,
        };
      });
      clearFeedback();
    },
    [clearFeedback],
  );

  const setCoverPhoto = useCallback(
    (url: string) => {
      setValues((current) => {
        if (!current) return current;
        const selected = current.existingPhotos.find((photo) => photo.url === url);
        return {
          ...current,
          coverPhotoUrl: url,
          coverApiUrl: selected?.apiUrl ?? selected?.url ?? current.coverApiUrl,
          mainPhoto: null,
        };
      });
      clearFeedback();
    },
    [clearFeedback],
  );

  const addNewPhotos = useCallback(
    (files: FileList | File[]) => {
      const next = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (next.length === 0) return;
      setValues((current) =>
        current
          ? { ...current, photos: [...current.photos, ...next] }
          : current,
      );
      clearFeedback();
    },
    [clearFeedback],
  );

  const removeNewPhoto = useCallback(
    (index: number) => {
      setValues((current) =>
        current
          ? {
              ...current,
              photos: current.photos.filter((_, itemIndex) => itemIndex !== index),
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
    if (details.editability === "locked") {
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
    const wasRejected = details.status === "Rejected";
    const submitGeneration = loadGenerationRef.current;
    const isSubmitStale = () =>
      submitGeneration !== loadGenerationRef.current || targetHallId !== hallId;

    try {
      const updated = await updateOwnerHall(targetHallId, values);
      if (isSubmitStale()) return false;

      const saved = updated ?? (await fetchOwnerHallDetails(targetHallId));
      if (isSubmitStale() || saved.id !== targetHallId) return false;
      hydrateFromDetails(saved);

      if (isSubmitStale()) return false;
      setResubmitted(wasRejected && saved.status === "Pending");
      setSubmitStatus("success");
      notifyHallOwnerHallsChanged();
      notifyPublicHallsChanged();
      return true;
    } catch (err) {
      if (isSubmitStale()) return false;

      if (isUnauthorizedApiError(err) || (err instanceof ApiError && err.code === "Unauthorized")) {
        await logout({ redirect: false });
        setFieldErrors({});
        setFormError("owner.management.hallEdit.errors.unauthorized");
        setSubmitStatus("error");
        return false;
      }

      if (isForbiddenApiError(err) || (err instanceof ApiError && err.code === "Forbidden")) {
        setFieldErrors({});
        setFormError("owner.management.hallEdit.errors.forbidden");
        setSubmitStatus("error");
        return false;
      }

      if (isPaymentRequiredApiError(err)) {
        reportOwnedHallPaymentRequired(targetHallId);
        setFormError(null);
        setSubmitStatus("idle");
        return false;
      }

      if (isHallLockedApiError(err)) {
        reportOwnedHallAdminLocked(targetHallId);
        setFormError(null);
        setSubmitStatus("idle");
        return false;
      }

      if (isSystemLockedApiError(err)) {
        reportOwnedHallSystemLocked(targetHallId);
        setFormError(null);
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
        const mapped = mapHallApiErrorsToFormErrors(err);
        setFieldErrors(mapped);
        setFormError(
          Object.keys(mapped).length > 0
            ? "owner.management.addHall.errors.validation"
            : hallUpdateSubmitErrorMessage(err),
        );
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
    isPaymentRequired: loadStatus === "payment_required",
    isSystemLocked: loadStatus === "system_locked",
    isAdminLocked: loadStatus === "admin_locked",
    isSubmitting: submitStatus === "submitting",
    isSuccess: submitStatus === "success" && detailsMatchSelection,
    resubmitted: resubmitted && detailsMatchSelection,
    canEdit,
    controlsDisabled,
    reload: load,
    patchValues,
    removeExistingPhoto,
    setCoverPhoto,
    addNewPhotos,
    removeNewPhoto,
    submit,
  };
}
