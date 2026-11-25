"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { patchStoredUser } from "@/lib/auth-storage";
import { normalizePublishingLock } from "@/lib/publishing-lock";
import { isProfessionalRole } from "@/lib/account-role";
import { MAX_TIMEOUT_MS } from "@/lib/offer-lifecycle";
import { createRequestScope } from "@/lib/request-scope";
import {
  isCurrentAuthenticatedAccount,
  readAuthenticatedAccount,
  serverAuthenticatedAccount,
  subscribeAuthenticatedAccount,
} from "@/lib/authenticated-account";
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
  const knownId = profile.id.trim();
  patchStoredUser({
    ...(knownId && knownId !== "self" ? { id: knownId } : {}),
    name: profile.fullName,
    email: profile.email,
    phone: profile.phoneNumber,
  });
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { applyIdentity, session } = useAuth();
  const { ready, authenticated, canOpenRegularProfile, displayName: seedName } =
    useAccountAccess();
  const account = useSyncExternalStore(
    subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  );
  const requestScope = useMemo(() => ({
    account, ready, authenticated, canOpenRegularProfile, ...createRequestScope(),
  }), [account, ready, authenticated, canOpenRegularProfile]);
  const generationRef = useRef(0);
  const profileRef = useRef<UserProfile | null>(null);
  const savingRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const restrictionRefreshRef = useRef<Promise<void> | null>(null);
  useLayoutEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = null;
    restrictionRefreshRef.current = null;
    savingRef.current = false;
    requestScope.activate();
    return () => requestScope.dispose();
  }, [requestScope]);
  const isCurrent = useCallback(() =>
    ready && authenticated && canOpenRegularProfile && requestScope.isActive() &&
    isCurrentAuthenticatedAccount(account),
  [account, ready, authenticated, canOpenRegularProfile, requestScope]);

  const [status, setStatus] = useState<UserProfileStoreStatus>("idle");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const seedRef = useRef(seedName);

  const [previousScope, setPreviousScope] = useState(requestScope);
  // Reset before children render; account changes must never expose the old profile.
  if (previousScope !== requestScope) {
    setPreviousScope(requestScope);
    setProfile(null);
    setSaving(false);
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    setStatus(!authenticated || !account ? "idle" : !canOpenRegularProfile ? "forbidden" : "loading");
  }

  useLayoutEffect(() => {
    profileRef.current = profile;
    seedRef.current = seedName;
  });

  const clearFormFeedback = useCallback(() => {
    if (!isCurrent()) return;
    setFormError(null);
    setFieldErrors({});
  }, [isCurrent]);

  const applyStampOnly = useCallback((stamp: string) => {
    if (!stamp) return;
    setProfile((current) =>
      current && current.concurrencyStamp !== stamp
        ? { ...current, concurrencyStamp: stamp }
        : current,
    );
  }, []);

  const refetch = useCallback(async (replacePending = false) => {
    const captured = requestScope.capture();
    const active = () => captured() && isCurrent();
    if (!canOpenRegularProfile || !active()) return;
    if (inFlightRef.current && !replacePending) return inFlightRef.current;

    const generation = ++generationRef.current;
    if (!profileRef.current) setStatus("loading");
    setLoadError(null);

    const run = (async () => {
      try {
        const next = await fetchProfile(seedRef.current);
        if (!active() || generation !== generationRef.current) return;
        setProfile(next);
        publishIdentity(next, applyIdentity);
        setStatus("ready");
      } catch (err) {
        if (!active() || generation !== generationRef.current) return;
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
  }, [applyIdentity, canOpenRegularProfile, isCurrent, requestScope]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      generationRef.current += 1;
      inFlightRef.current = null;
      restrictionRefreshRef.current = null;
      applyIdentity({ userName: null });
      return;
    }

    if (!canOpenRegularProfile) {
      generationRef.current += 1;
      inFlightRef.current = null;
      restrictionRefreshRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, authenticated, canOpenRegularProfile, applyIdentity, refetch, requestScope]);

  // A wake/expiry refresh supersedes an older GET, while focus + visibility share one request.
  const refreshRestrictions = useCallback(() => {
    if (restrictionRefreshRef.current) return restrictionRefreshRef.current;
    const pending = refetch(true);
    restrictionRefreshRef.current = pending;
    void pending.finally(() => {
      if (restrictionRefreshRef.current === pending) restrictionRefreshRef.current = null;
    });
    return pending;
  }, [refetch]);

  useEffect(() => {
    if (!isCurrent() || !isProfessionalRole(session.role)) return;
    const active = requestScope.capture();
    const current = () => active() && isCurrent();
    let timer: number | undefined;
    let disposed = false;
    const deadline = profile?.isLocked && profile.lockedUntil ? Date.parse(profile.lockedUntil) : NaN;
    const normalize = () => {
      if (current()) setProfile((profile) => profile ? normalizePublishingLock(profile) : profile);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      if (!Number.isFinite(deadline) || disposed) return;
      timer = window.setTimeout(() => {
        if (disposed || !current()) return;
        if (Date.now() < deadline) { schedule(); return; }
        normalize();
        void refreshRestrictions();
      }, Math.min(MAX_TIMEOUT_MS, Math.max(0, deadline - Date.now())));
    };
    const resume = () => {
      if (document.visibilityState === "hidden" || disposed || !current()) return;
      normalize();
      void refreshRestrictions();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [isCurrent, requestScope, session.role, profile?.isLocked, profile?.lockedUntil, refreshRestrictions]);

  const save = useCallback(
    async (input: Omit<UpdateProfileInput, "concurrencyStamp">): Promise<boolean> => {
      if (!profile || savingRef.current || !isCurrent()) return false;
      const captured = requestScope.capture();
      const active = () => captured() && isCurrent();
      savingRef.current = true;

      setSaving(true);
      setFormError(null);
      setFieldErrors({});

      try {
        const next = await updateProfile(
          { ...input, concurrencyStamp: profile.concurrencyStamp },
          seedName,
        );
        if (!active()) return false;
        generationRef.current += 1;
        setProfile(next);
        publishIdentity(next, applyIdentity);
        setStatus("ready");
        return true;
      } catch (err) {
        if (!active()) return false;
        const failure =
          err instanceof ProfileError ? err : new ProfileError("errors.profile.save");

        if (failure.code === "stale" || failure.code === "conflict") {
          try {
            const latest = await fetchProfile(seedRef.current);
            if (!active()) return false;
            applyStampOnly(failure.currentStamp || latest.concurrencyStamp);
          } catch {
            if (!active()) return false;
            applyStampOnly(failure.currentStamp ?? "");
          }
        }

        setFieldErrors(failure.fields);
        const duplicateFieldError =
          failure.code === "email_taken" || failure.code === "phone_taken";
        setFormError(duplicateFieldError ? null : failure.message || "errors.profile.save");
        return false;
      } finally {
        if (active()) {
          savingRef.current = false;
          setSaving(false);
        }
      }
    },
    [applyIdentity, applyStampOnly, isCurrent, profile, requestScope, seedName],
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
