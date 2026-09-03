"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { patchStoredUser } from "@/lib/auth-storage";
import { ProfileError } from "@/lib/profile-errors";
import { fetchProfile, updateProfile } from "@/services/profile";
import type { ProfileFieldErrors, UpdateProfileInput, UserProfile } from "@/types/profile";

export type UserProfileStoreStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "forbidden";

type UserProfileContextValue = {
  status: UserProfileStoreStatus;
  profile: UserProfile | null;
  saving: boolean;
  loadError: string | null;
  formError: string | null;
  fieldErrors: ProfileFieldErrors;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  refetch: () => Promise<void>;
  save: (input: Omit<UpdateProfileInput, "concurrencyStamp">) => Promise<boolean>;
  clearFormFeedback: () => void;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

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

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { applyIdentity } = useAuth();
  const { ready, authenticated, canOpenRegularProfile, displayName: seedName } =
    useAccountAccess();

  const [status, setStatus] = useState<UserProfileStoreStatus>("idle");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const generationRef = useRef(0);
  const profileRef = useRef<UserProfile | null>(null);
  const seedRef = useRef(seedName);
  const inFlightRef = useRef<Promise<void> | null>(null);

  profileRef.current = profile;
  seedRef.current = seedName;

  const resetStore = useCallback(() => {
    generationRef.current += 1;
    inFlightRef.current = null;
    setProfile(null);
    setSaving(false);
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    setStatus("idle");
  }, []);

  const clearFormFeedback = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
  }, []);

  const applyStampOnly = useCallback((stamp: string) => {
    if (!stamp) return;
    setProfile((current) =>
      current && current.concurrencyStamp !== stamp
        ? { ...current, concurrencyStamp: stamp }
        : current,
    );
  }, []);

  const refetch = useCallback(async () => {
    if (!canOpenRegularProfile) return;
    if (inFlightRef.current) return inFlightRef.current;

    const generation = ++generationRef.current;
    if (!profileRef.current) setStatus("loading");
    setLoadError(null);

    const run = (async () => {
      try {
        const next = await fetchProfile(seedRef.current);
        if (generation !== generationRef.current) return;
        setProfile(next);
        publishIdentity(next, applyIdentity);
        setStatus("ready");
      } catch (err) {
        if (generation !== generationRef.current) return;
        setLoadError(err instanceof ProfileError ? err.message : "errors.profile.load");
        if (!profileRef.current) setStatus("error");
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
    }
  }, [applyIdentity, canOpenRegularProfile]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      resetStore();
      applyIdentity({ userName: null });
      return;
    }

    if (!canOpenRegularProfile) {
      generationRef.current += 1;
      inFlightRef.current = null;
      setProfile(null);
      setLoadError(null);
      setFormError(null);
      setFieldErrors({});
      setStatus("forbidden");
      return;
    }

    void refetch();
  }, [ready, authenticated, canOpenRegularProfile, resetStore, applyIdentity, refetch]);

  const save = useCallback(
    async (input: Omit<UpdateProfileInput, "concurrencyStamp">): Promise<boolean> => {
      if (!profile || saving || !canOpenRegularProfile) return false;

      setSaving(true);
      setFormError(null);
      setFieldErrors({});

      try {
        const next = await updateProfile(
          { ...input, concurrencyStamp: profile.concurrencyStamp },
          seedName,
        );
        generationRef.current += 1;
        setProfile(next);
        publishIdentity(next, applyIdentity);
        setStatus("ready");
        return true;
      } catch (err) {
        const failure =
          err instanceof ProfileError ? err : new ProfileError("errors.profile.save");

        if (failure.code === "stale" || failure.code === "conflict") {
          try {
            const latest = await fetchProfile(seedRef.current);
            applyStampOnly(failure.currentStamp || latest.concurrencyStamp);
          } catch {
            applyStampOnly(failure.currentStamp ?? "");
          }
        }

        setFieldErrors(failure.fields);
        const duplicateFieldError =
          failure.code === "email_taken" || failure.code === "phone_taken";
        setFormError(duplicateFieldError ? null : failure.message || "errors.profile.save");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [applyIdentity, applyStampOnly, canOpenRegularProfile, profile, saving, seedName],
  );

  const value = useMemo<UserProfileContextValue>(
    () => ({
      status,
      profile,
      saving,
      loadError,
      formError,
      fieldErrors,
      displayName: profile?.fullName ?? seedName,
      email: profile?.email ?? null,
      phoneNumber: profile?.phoneNumber ?? null,
      refetch,
      save,
      clearFormFeedback,
    }),
    [
      clearFormFeedback,
      fieldErrors,
      formError,
      loadError,
      profile,
      refetch,
      save,
      saving,
      seedName,
      status,
    ],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfileStore(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfileStore must be used within UserProfileProvider");
  }
  return context;
}

export function useOptionalUserProfileStore(): UserProfileContextValue | null {
  return useContext(UserProfileContext);
}
