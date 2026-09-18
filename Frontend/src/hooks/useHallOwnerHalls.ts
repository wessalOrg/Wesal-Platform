"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";
import { subscribeHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { fetchHallOwnerHalls } from "@/services/hall-owner-halls";
import type {
  HallOwnerHall,
  HallOwnerHallsLoadStatus,
} from "@/types/hall-owner-halls";
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";

type HallOwnerHallsSnapshot = {
  halls: HallOwnerHall[];
  status: HallOwnerHallsLoadStatus;
  errorKey: string | null;
  isRefreshing: boolean;
  hasLoaded: boolean;
};

const listeners = new Set<() => void>();

let snapshot: HallOwnerHallsSnapshot = {
  halls: [],
  status: "idle",
  errorKey: null,
  isRefreshing: false,
  hasLoaded: false,
};

let generation = 0;
/** Prior approval statuses — used to detect Pending → Approved for public revalidation. */
let previousApprovalById = new Map<string, HallApprovalStatus>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(partial: Partial<HallOwnerHallsSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HallOwnerHallsSnapshot {
  return snapshot;
}

function detectNewlyApproved(next: HallOwnerHall[]): boolean {
  // First successful population establishes a baseline — not a transition.
  const hasBaseline = snapshot.hasLoaded;
  let newlyApproved = false;
  if (hasBaseline) {
    for (const hall of next) {
      const previous = previousApprovalById.get(hall.id);
      if (hall.status === "Approved" && previous !== "Approved") {
        newlyApproved = true;
        break;
      }
    }
  }
  previousApprovalById = new Map(
    next.map((hall) => [hall.id, hall.status] as const),
  );
  return newlyApproved;
}

async function loadHallOwnerHalls(
  mode: "initial" | "refresh",
  logout: () => Promise<void>,
): Promise<void> {
  const gen = ++generation;
  const treatAsInitial = mode === "initial" || !snapshot.hasLoaded;

  if (treatAsInitial) {
    setSnapshot({ status: "loading", errorKey: null, isRefreshing: false });
  } else {
    setSnapshot({ errorKey: null, isRefreshing: true });
  }

  try {
    const next = await fetchHallOwnerHalls();
    if (gen !== generation) return;
    const shouldRevalidatePublic = detectNewlyApproved(next);
    setSnapshot({
      halls: next,
      status: "ready",
      errorKey: null,
      isRefreshing: false,
      hasLoaded: true,
    });
    // Approved ≠ public. Only ask discovery views to refetch existing APIs.
    if (shouldRevalidatePublic) {
      notifyPublicHallsChanged();
    }
  } catch (err) {
    if (gen !== generation) return;
    if (isUnauthorizedApiError(err)) {
      await logout();
      previousApprovalById = new Map();
      setSnapshot({
        halls: [],
        status: "idle",
        errorKey: null,
        isRefreshing: false,
        hasLoaded: false,
      });
      return;
    }
    const errorKey =
      err instanceof ApiError && err.status === 0
        ? "owner.management.halls.networkError"
        : "owner.management.halls.loadError";

    if (!snapshot.hasLoaded) {
      setSnapshot({
        halls: [],
        status: "error",
        errorKey,
        isRefreshing: false,
      });
    } else {
      setSnapshot({
        status: "ready",
        errorKey,
        isRefreshing: false,
      });
    }
  }
}

function resetHallOwnerHallsStore(): void {
  generation += 1;
  previousApprovalById = new Map();
  setSnapshot({
    halls: [],
    status: "idle",
    errorKey: null,
    isRefreshing: false,
    hasLoaded: false,
  });
}

/**
 * Orchestrates Hall Owner halls + live approval status (US-OWNER-05).
 * Shared module snapshot so sidebar + status panel reuse one fetch.
 * Refetches on mount, tab visibility, and create-success notify.
 * Newer requests supersede older ones (generation) so post-create refresh
 * is not dropped behind an in-flight list load.
 */
export function useHallOwnerHalls() {
  const { logout } = useAuth();
  const { ready, authenticated, isHallOwner } = useAccountAccess();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const logoutQuiet = useCallback(async () => {
    await logout({ redirect: false });
  }, [logout]);

  const refetch = useCallback(() => {
    void loadHallOwnerHalls(
      snapshot.hasLoaded ? "refresh" : "initial",
      logoutQuiet,
    );
  }, [logoutQuiet]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !isHallOwner) {
      resetHallOwnerHallsStore();
      return;
    }
    void loadHallOwnerHalls("initial", logoutQuiet);
  }, [ready, authenticated, isHallOwner, logoutQuiet]);

  useEffect(() => {
    if (!ready || !authenticated || !isHallOwner) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadHallOwnerHalls("refresh", logoutQuiet);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, authenticated, isHallOwner, logoutQuiet]);

  useEffect(() => {
    return subscribeHallOwnerHallsChanged(() => {
      void loadHallOwnerHalls("refresh", logoutQuiet);
    });
  }, [logoutQuiet]);

  return {
    halls: state.halls,
    status: state.status,
    errorKey: state.errorKey,
    isLoading: state.status === "loading",
    isError: state.status === "error",
    isRefreshing: state.isRefreshing,
    refetch,
  };
}
