"use client";

import { useEffect } from "react";
import { subscribePublicHallsChanged } from "@/lib/public-halls-events";

/**
 * Alaa / Lilian shared revalidation trigger for public discovery views.
 * Bumps the consumer's existing reload path — does not fetch itself.
 */
export function usePublicHallsRevalidation(onRevalidate: () => void) {
  useEffect(() => {
    return subscribePublicHallsChanged(onRevalidate);
  }, [onRevalidate]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        onRevalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onRevalidate]);
}
