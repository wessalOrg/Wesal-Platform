"use client";

import { useEffect, useState } from "react";

export type BookingViewport = "mobile" | "tablet" | "desktop";

const TABLET = "(min-width: 640px)";
const DESKTOP = "(min-width: 1024px)";

function readViewport(): BookingViewport {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "mobile";
  }
  if (window.matchMedia(DESKTOP).matches) return "desktop";
  if (window.matchMedia(TABLET).matches) return "tablet";
  return "mobile";
}

/** Mirrors Tailwind `sm` / `lg` so date and period layouts can follow the viewport. */
export function useBookingViewport(): BookingViewport {
  const [viewport, setViewport] = useState<BookingViewport>("mobile");

  useEffect(() => {
    const tablet = window.matchMedia(TABLET);
    const desktop = window.matchMedia(DESKTOP);

    const update = () => setViewport(readViewport());
    update();

    tablet.addEventListener("change", update);
    desktop.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);

  return viewport;
}
