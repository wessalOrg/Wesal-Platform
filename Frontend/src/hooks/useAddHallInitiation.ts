"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { HALL_OWNER_ADD_HALL_PATH } from "@/lib/account-profile-path";
import {
  clearAddHallInitiationCache,
  peekAddHallInitiation,
  rememberAddHallInitiation,
  warmAddHallInitiation,
} from "@/lib/add-hall-initiation-cache";
import {
  addHallInitiationErrorMessage,
  isUnauthorizedApiError,
} from "@/lib/add-hall-initiation-errors";
import { initiateAddHall } from "@/services/add-hall-initiation";
import type { AddHallInitiationUiState } from "@/types/add-hall-initiation";

function buildAddHallHref(initiationId: string | null): string {
  if (!initiationId) return HALL_OWNER_ADD_HALL_PATH;
  const params = new URLSearchParams({ initiationId });
  return `${HALL_OWNER_ADD_HALL_PATH}?${params.toString()}`;
}

export function useAddHallInitiation() {
  const router = useRouter();
  const { logout } = useAuth();
  const [state, setState] = useState<AddHallInitiationUiState>({ status: "idle" });
  const inFlightRef = useRef(false);

  useEffect(() => {
    router.prefetch(HALL_OWNER_ADD_HALL_PATH);
    void warmAddHallInitiation();
  }, [router]);

  const clearFeedback = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const goToForm = useCallback(
    (initiationId: string | null) => {
      const href = buildAddHallHref(initiationId);
      router.prefetch(href);
      startTransition(() => {
        router.push(href);
      });
      setState({ status: "idle" });
      // Refresh cache for the next visit without blocking navigation.
      void warmAddHallInitiation();
    },
    [router],
  );

  const startAddHall = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState({ status: "loading" });

    try {
      const warmed = peekAddHallInitiation();
      if (warmed?.status === "allowed") {
        clearAddHallInitiationCache();
        goToForm(warmed.initiationId);
        return;
      }
      if (warmed?.status === "blocked") {
        setState({ status: "blocked", message: warmed.message });
        return;
      }

      const result = await initiateAddHall();
      rememberAddHallInitiation(result);

      if (result.status === "blocked") {
        setState({ status: "blocked", message: result.message });
        return;
      }

      // Navigate only after backend allows initiation — no optimistic routing.
      goToForm(result.initiationId);
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        clearAddHallInitiationCache();
        await logout({ redirect: false });
        setState({ status: "idle" });
        return;
      }
      setState({
        status: "failed",
        message: addHallInitiationErrorMessage(err),
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [goToForm, logout]);

  return {
    state,
    isInitiating: state.status === "loading",
    startAddHall,
    clearFeedback,
    warmInitiation: warmAddHallInitiation,
  };
}
