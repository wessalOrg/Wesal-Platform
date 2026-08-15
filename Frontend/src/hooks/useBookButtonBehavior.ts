"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import {
  buildLoginRedirectPath,
  buildRegisterRedirectPath,
  saveBookingHallContext,
} from "@/lib/auth-storage";

type UseBookButtonBehaviorOptions = {
  hallId: string;
  hydrated: boolean;
  isAuthenticated: boolean;
  unavailable: boolean;
  onOpenBooking: () => void;
};

export function buildHallReturnPath(hallId: string, openBooking = false): string {
  return buildHallDetailsPath(hallId, openBooking);
}

export function useBookButtonBehavior({
  hallId,
  hydrated,
  isAuthenticated,
  unavailable,
  onOpenBooking,
}: UseBookButtonBehaviorOptions) {
  const router = useRouter();

  const handleBook = useCallback(() => {
    if (!hydrated || unavailable) return;

    if (!isAuthenticated) {
      saveBookingHallContext(hallId);
      router.push(buildRegisterRedirectPath(hallId));
      return;
    }

    onOpenBooking();
  }, [hydrated, unavailable, isAuthenticated, hallId, onOpenBooking, router]);

  return {
    handleBook,
    returnPath: buildHallDetailsPath(hallId, true),
    loginHref: buildLoginRedirectPath(hallId, true),
    registerHref: buildRegisterRedirectPath(hallId),
  };
}
