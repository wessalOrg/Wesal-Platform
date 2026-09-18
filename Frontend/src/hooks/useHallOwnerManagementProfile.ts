"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { patchStoredUser } from "@/lib/auth-storage";
import { ProfileError } from "@/lib/profile-errors";
import {
  fetchHallOwnerManagementProfile,
  updateHallOwnerManagementProfile,
} from "@/services/hall-owner-management";
import type { ProfileFieldErrors, UpdateProfileInput, UserProfile } from "@/types/profile";

export type HallOwnerProfileLoadStatus = "idle" | "loading" | "ready" | "error";

function publishIdentity(
  profile: UserProfile,
  applyIdentity: (patch: { userName?: string | null }) => void,
) {
  applyIdentity({ userName: profile.fullName });
  patchStoredUser({
    id: profile.id,
    name: profile.fullName,
    email: profile.email,
    phone: profile.phoneNumber,
  });
}

export function useHallOwnerManagementProfile() {
  const { applyIdentity } = useAuth();
  const { ready, authenticated, isHallOwner, displayName } = useAccountAccess();

  const [status, setStatus] = useState<HallOwnerProfileLoadStatus>("idle");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});

  const generationRef = useRef(0);
  const profileRef = useRef<UserProfile | null>(null);
  const savingRef = useRef(false);
  const displayNameRef = useRef(displayName);
  profileRef.current = profile;
  savingRef.current = saving;
  displayNameRef.current = displayName;

  const clearFormFeedback = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
    setSaveSuccess(false);
  }, []);

  const applyStampOnly = useCallback((stamp: string) => {
    if (!stamp) return;
    setProfile((current) =>
      current && current.concurrencyStamp !== stamp
        ? { ...current, concurrencyStamp: stamp }
        : current,
    );
  }, []);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setStatus("loading");
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    setSaveSuccess(false);

    try {
      const next = await fetchHallOwnerManagementProfile(displayNameRef.current);
      if (generation !== generationRef.current) return;
      setProfile(next);
      publishIdentity(next, applyIdentity);
      setStatus("ready");
    } catch (err) {
      if (generation !== generationRef.current) return;
      setProfile(null);
      setStatus("error");
      setLoadError(err instanceof ProfileError ? err.message : "errors.profile.load");
    }
  }, [applyIdentity]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !isHallOwner) {
      generationRef.current += 1;
      setProfile(null);
      setLoadError(null);
      setSaving(false);
      setFormError(null);
      setFieldErrors({});
      setSaveSuccess(false);
      setStatus("idle");
      return;
    }
    void load();
  }, [ready, authenticated, isHallOwner, load]);

  const save = useCallback(
    async (input: Omit<UpdateProfileInput, "concurrencyStamp">): Promise<boolean> => {
      const current = profileRef.current;
      if (!current || savingRef.current) return false;

      setSaving(true);
      setFormError(null);
      setFieldErrors({});
      setSaveSuccess(false);

      try {
        const next = await updateHallOwnerManagementProfile(
          { ...input, concurrencyStamp: current.concurrencyStamp },
          displayNameRef.current,
        );
        generationRef.current += 1;
        setProfile(next);
        publishIdentity(next, applyIdentity);
        setStatus("ready");
        setSaveSuccess(true);
        return true;
      } catch (err) {
        const failure =
          err instanceof ProfileError ? err : new ProfileError("errors.profile.save");

        if (failure.code === "stale" || failure.code === "conflict") {
          try {
            const latest = await fetchHallOwnerManagementProfile(displayNameRef.current);
            applyStampOnly(failure.currentStamp || latest.concurrencyStamp);
          } catch {
            applyStampOnly(failure.currentStamp ?? "");
          }
        }

        setFieldErrors(failure.fields);
        const duplicateFieldError =
          failure.code === "email_taken" || failure.code === "phone_taken";
        setFormError(duplicateFieldError ? null : failure.message || "errors.profile.save");
        setSaveSuccess(false);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [applyIdentity, applyStampOnly],
  );

  return {
    authReady: ready,
    status,
    profile,
    loadError,
    saving,
    saveSuccess,
    formError,
    fieldErrors,
    reload: load,
    save,
    clearFormFeedback,
  };
}
