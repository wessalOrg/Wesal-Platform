"use client";

import { useEffect } from "react";
import { useUserProfileStore } from "@/components/profile/UserProfileProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import type { ProfileFieldErrors, UpdateProfileInput, UserProfile } from "@/types/profile";

type ProfileStatus = "loading" | "ready" | "unauthorized" | "forbidden" | "error";

export type UseUserProfile = {
  status: ProfileStatus;
  authReady: boolean;
  profile: UserProfile | null;
  saving: boolean;
  formError: string | null;
  fieldErrors: ProfileFieldErrors;
  loadError: string | null;
  save: (input: Omit<UpdateProfileInput, "concurrencyStamp">) => Promise<boolean>;
  reload: () => void;
  clearFormFeedback: () => void;
};

export function useUserProfile(): UseUserProfile {
  const { ready, authenticated, canOpenRegularProfile } = useAccountAccess();
  const store = useUserProfileStore();

  useEffect(() => {
    if (!ready || !canOpenRegularProfile) return;
    void store.refetch();
  }, [ready, canOpenRegularProfile, store.refetch]);

  const status: ProfileStatus = !ready
    ? "loading"
    : !authenticated
      ? "unauthorized"
      : store.status === "forbidden" || !canOpenRegularProfile
        ? "forbidden"
        : store.status === "error"
          ? "error"
          : store.status === "ready" && store.profile
            ? "ready"
            : "loading";

  return {
    status,
    authReady: ready,
    profile: store.profile,
    saving: store.saving,
    formError: store.formError,
    fieldErrors: store.fieldErrors,
    loadError: store.loadError,
    save: store.save,
    reload: () => {
      void store.refetch();
    },
    clearFormFeedback: store.clearFormFeedback,
  };
}
