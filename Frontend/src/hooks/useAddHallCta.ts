"use client";

import { useCallback, useMemo, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ADD_HALL_REGISTER_HREF,
  resolveAddHallCtaHref,
} from "@/lib/add-hall-cta";

/**
 * Shared navigation for Landing/Footer "Add your hall" CTAs.
 * Blocks clicks until auth status is ready to avoid Guest mis-routing.
 */
export function useAddHallCta() {
  const { session, status } = useAuth();
  const router = useRouter();

  const resolvedHref = useMemo(
    () =>
      resolveAddHallCtaHref({
        authStatus: status,
        isAuthenticated: session.isAuthenticated,
        role: session.role,
      }),
    [status, session.isAuthenticated, session.role],
  );

  const isReady = status === "ready" && resolvedHref != null;
  /** Safe Link `href` while auth loads (never Hall Owner routes until ready). */
  const href = resolvedHref ?? ADD_HALL_REGISTER_HREF;

  const guardClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isReady) {
        event.preventDefault();
      }
    },
    [isReady],
  );

  const prefetch = useCallback(() => {
    if (resolvedHref) router.prefetch(resolvedHref);
  }, [resolvedHref, router]);

  return { href, isReady, guardClick, prefetch };
}
