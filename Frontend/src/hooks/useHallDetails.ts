"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchHallDetails } from "@/services/halls";
import type { HallDetail, HallDetailsLoadResult } from "@/types/hall";

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; result: HallDetailsLoadResult }
  | { phase: "fatal"; message: string };

export function useHallDetails(hallId: string) {
  const { session, status: authStatus } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const refreshQuiet = useCallback(() => {
    void fetchHallDetails(hallId).then((result) => {
      if (result.status === "not_found") return;
      setState((current) => {
        if (current.phase === "fatal") return current;
        return { phase: "ready", result };
      });
    });
  }, [hallId]);

  useEffect(() => {
    if (authStatus !== "ready") {
      setState({ phase: "loading" });
      return;
    }

    let active = true;
    setState({ phase: "loading" });

    void fetchHallDetails(hallId).then((result) => {
      if (!active) return;

      if (result.status === "not_found") {
        setState({
          phase: "fatal",
          message: "لم يتم العثور على القاعة المطلوبة.",
        });
        return;
      }

      setState({ phase: "ready", result });
    });

    return () => {
      active = false;
    };
  }, [hallId, reloadKey, authStatus, session.isAuthenticated]);

  const hall: HallDetail | undefined =
    state.phase === "ready"
      ? state.result.status === "error"
        ? state.result.hall
        : "hall" in state.result
          ? state.result.hall
          : undefined
      : undefined;

  const unavailable =
    state.phase === "ready" &&
    (state.result.status === "unavailable" || (hall != null && !hall.isActive));

  const usingFallback =
    state.phase === "ready" &&
    state.result.status === "error" &&
    state.result.source === "fallback";

  const errorMessage =
    state.phase === "ready" && state.result.status === "error"
      ? state.result.error
      : undefined;

  return {
    state,
    hall,
    unavailable: Boolean(unavailable),
    usingFallback: Boolean(usingFallback),
    errorMessage,
    retry,
    refreshQuiet,
  };
}
