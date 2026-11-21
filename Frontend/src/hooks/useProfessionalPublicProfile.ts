"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequestScope } from "@/hooks/useRequestScope";
import { ApiError } from "@/lib/api-error";
import { fetchPublicProfessionalProfile } from "@/services/professional-profile";
import type { PublicProfessionalProfile } from "@/types/professional-profile";

type LoadState =
  | { status: "loading"; profile: null; errorKey: null }
  | { status: "ready"; profile: PublicProfessionalProfile; errorKey: null }
  | { status: "error"; profile: null; errorKey: string }
  | { status: "notFound"; profile: null; errorKey: string };

export function useProfessionalPublicProfile(userId: string) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    profile: null,
    errorKey: null,
  });
  const scope = useRequestScope();

  const reload = useCallback(async () => {
    const current = scope.latest("profile");
    if (!current()) return;
    const id = userId.trim();
    if (!id) {
      setState({
        status: "notFound",
        profile: null,
        errorKey: "professionals.profile.errors.notFound",
      });
      return;
    }
    setState({ status: "loading", profile: null, errorKey: null });
    try {
      const profile = await fetchPublicProfessionalProfile(id);
      if (!current()) return;
      setState({ status: "ready", profile, errorKey: null });
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 404) {
        setState({
          status: "notFound",
          profile: null,
          errorKey: "professionals.profile.errors.notFound",
        });
        return;
      }
      setState({
        status: "error",
        profile: null,
        errorKey:
          error instanceof ApiError
            ? error.message || "professionals.profile.errors.loadFailed"
            : "professionals.profile.errors.loadFailed",
      });
    }
  }, [userId, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return {
    status: state.status,
    profile: state.profile,
    errorKey: state.errorKey,
    loading: state.status === "loading",
    reload,
  };
}
