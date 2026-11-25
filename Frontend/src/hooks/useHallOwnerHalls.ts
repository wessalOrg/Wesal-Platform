"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readAuthenticatedAccount, subscribeAuthenticatedAccount, serverAuthenticatedAccount,
  isCurrentAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";
import {
  notifyHallOwnerHallsChanged,
  subscribeHallOwnerHallsChanged,
} from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { fetchHallOwnerHalls } from "@/services/hall-owner-halls";
import type {
  HallOwnerHall,
  HallOwnerHallsLoadStatus,
} from "@/types/hall-owner-halls";
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { PaymentStatus } from "@/lib/hall-payment-status";
import type { HallSubscriptionStatus } from "@/types/hall-subscription";

type HallOwnerHallsSnapshot = {
  halls: HallOwnerHall[];
  status: HallOwnerHallsLoadStatus;
  errorKey: string | null;
  isRefreshing: boolean;
  hasLoaded: boolean;
};

const listeners = new Set<() => void>();
let owner: AuthenticatedAccount | null = null;

let snapshot: HallOwnerHallsSnapshot = {
  halls: [],
  status: "idle",
  errorKey: null,
  isRefreshing: false,
  hasLoaded: false,
};

let generation = 0;
// A subscription response can arrive before the owner list. Keep its positive
// admin-lock evidence until that session ends or an explicit list flag supersedes it.
const subscriptionAdminLocks = new Set<string>();
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
  const unsubscribe = subscribeAuthenticatedAccount(() => {
    const previous = owner; synchronizeOwner(); if (previous !== owner) emit();
  });
  return () => {
    unsubscribe();
    listeners.delete(listener);
  };
}

function synchronizeOwner() {
  const account = readAuthenticatedAccount();
  if (owner !== account) {
    owner = account; resetHallOwnerHallsStore(false);
  }
  return account;
}

function getSnapshot(): HallOwnerHallsSnapshot {
  synchronizeOwner();
  return snapshot;
}

export function applyOwnedHallPaymentStatus(
  hallId: string,
  paymentStatus: PaymentStatus,
): void {
  const id = hallId.trim();
  if (!id) return;
  setSnapshot({
    halls: snapshot.halls.map((hall) =>
      hall.id === id ? { ...hall, paymentStatus } : hall,
    ),
  });
}

export function applyOwnedHallSystemLocked(hallId: string): void {
  const id = hallId.trim();
  if (!id) return;
  setSnapshot({
    halls: snapshot.halls.map((hall) =>
      hall.id === id ? { ...hall, systemLocked: true } : hall,
    ),
  });
}

export function applyOwnedHallAdminLocked(hallId: string): void {
  const id = hallId.trim();
  if (!id) return;
  setSnapshot({
    halls: snapshot.halls.map((hall) =>
      hall.id === id ? { ...hall, adminLocked: true } : hall,
    ),
  });
}

/** Locked proves AdminLocked; other subscription states cannot establish overall unlock. */
export function applyOwnedHallSubscriptionStatus(
  account: AuthenticatedAccount,
  hallId: string,
  status: HallSubscriptionStatus,
): void {
  if (!isCurrentAuthenticatedAccount(account) || synchronizeOwner() !== account) return;
  if (status !== "locked") return;
  subscriptionAdminLocks.add(hallId);
  const adminLocked = true;
  if (!snapshot.halls.some((hall) => hall.id === hallId && hall.adminLocked !== adminLocked)) return;
  setSnapshot({ halls: snapshot.halls.map((hall) =>
    hall.id === hallId ? { ...hall, adminLocked } : hall,
  ) });
}

export function reportOwnedHallPaymentRequired(hallId: string): void {
  applyOwnedHallPaymentStatus(hallId, "Unpaid");
  notifyHallOwnerHallsChanged();
}

export function reportOwnedHallSystemLocked(hallId: string): void {
  applyOwnedHallSystemLocked(hallId);
  notifyHallOwnerHallsChanged();
}

export function reportOwnedHallAdminLocked(hallId: string): void {
  applyOwnedHallAdminLocked(hallId);
  notifyHallOwnerHallsChanged();
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
  account: AuthenticatedAccount | null,
  mode: "initial" | "refresh",
  logout: () => Promise<void>,
): Promise<void> {
  if (!account || !isCurrentAuthenticatedAccount(account) || synchronizeOwner() !== account) return;
  if (mode === "initial" && snapshot.status === "loading") return;
  const gen = ++generation;
  const current = () => gen === generation && isCurrentAuthenticatedAccount(account);
  const treatAsInitial = mode === "initial" || !snapshot.hasLoaded;

  if (treatAsInitial) {
    setSnapshot({ status: "loading", errorKey: null, isRefreshing: false });
  } else {
    setSnapshot({ errorKey: null, isRefreshing: true });
  }

  try {
    const next = await fetchHallOwnerHalls();
    if (!current()) return;
    const shouldRevalidatePublic = detectNewlyApproved(next);
    setSnapshot({
      // A DTO that omits flags cannot clear an explicit lock/authoritative observation.
      halls: next.map((hall) => {
        const previous = snapshot.halls.find((item) => item.id === hall.id);
        if (hall.adminLocked !== null) subscriptionAdminLocks.delete(hall.id);
        return { ...hall,
          adminLocked: hall.adminLocked ?? (subscriptionAdminLocks.has(hall.id) ? true : previous?.adminLocked ?? null),
          systemLocked: hall.systemLocked ?? previous?.systemLocked ?? null,
        };
      }),
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
    if (!current()) return;
    if (isUnauthorizedApiError(err)) {
      await logout();
      if (!current()) return;
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

function resetHallOwnerHallsStore(notify = true): void {
  generation += 1;
  subscriptionAdminLocks.clear();
  previousApprovalById = new Map();
  snapshot = {
    halls: [],
    status: "idle",
    errorKey: null,
    isRefreshing: false,
    hasLoaded: false,
  };
  if (notify) emit();
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
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const logoutQuiet = useCallback(async () => {
    await logout({ redirect: false });
  }, [logout]);

  const refetch = useCallback(() => {
    if (!ready || !authenticated || !isHallOwner) return;
    void loadHallOwnerHalls(
      account,
      snapshot.hasLoaded ? "refresh" : "initial",
      logoutQuiet,
    );
  }, [logoutQuiet, account, ready, authenticated, isHallOwner]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !isHallOwner) {
      resetHallOwnerHallsStore();
      return;
    }
    void loadHallOwnerHalls(account, "initial", logoutQuiet);
  }, [ready, authenticated, isHallOwner, logoutQuiet, account]);

  useEffect(() => {
    if (!ready || !authenticated || !isHallOwner) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadHallOwnerHalls(account, "refresh", logoutQuiet);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, authenticated, isHallOwner, logoutQuiet, account]);

  useEffect(() => {
    if (!ready || !authenticated || !isHallOwner) return;
    return subscribeHallOwnerHallsChanged(() => {
      void loadHallOwnerHalls(account, "refresh", logoutQuiet);
    });
  }, [logoutQuiet, account, ready, authenticated, isHallOwner]);

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
