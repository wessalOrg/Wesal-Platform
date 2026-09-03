"use client";

import { useCallback } from "react";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import {
  buildLoginRedirectPath,
  buildRegisterRedirectPath,
} from "@/lib/auth-storage";

type UseBookButtonBehaviorOptions = {
  hallId: string;
  hydrated: boolean;
  canBook: boolean;
  unavailable: boolean;
  onOpenBooking: () => void;
};

export function buildHallReturnPath(hallId: string, openBooking = false): string {
  return buildHallDetailsPath(hallId, openBooking);
}

export function useBookButtonBehavior({
  hallId,
  hydrated,
  canBook,
  unavailable,
  onOpenBooking,
}: UseBookButtonBehaviorOptions) {
  const handleBook = useCallback(() => {
    if (!hydrated || unavailable || !canBook) return;
    onOpenBooking();
  }, [hydrated, unavailable, canBook, onOpenBooking]);

  return {
    handleBook,
    returnPath: buildHallDetailsPath(hallId, true),
    loginHref: buildLoginRedirectPath(hallId, true),
    registerHref: buildRegisterRedirectPath(hallId),
  };
}
