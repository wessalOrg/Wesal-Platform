"use client";

import { useCallback, useEffect, useState } from "react";

/** Minimal typing for the Chromium install prompt event. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function detectIos(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const ua = navigator.userAgent || "";
  // iPhone / iPad / iPod, plus iPadOS 13+ reporting as Macintosh with touch.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (ua.includes("Macintosh") &&
      typeof window !== "undefined" &&
      "ontouchend" in window &&
      navigator.maxTouchPoints > 1)
  );
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari proprietary flag.
  if ((window.navigator as { standalone?: boolean }).standalone === true)
    return true;
  return false;
}

/**
 * Central PWA install state.
 * - Chromium/Android: captures `beforeinstallprompt` for the native prompt.
 * - iOS/Safari: no `beforeinstallprompt` — callers show manual instructions.
 * - Never claims installability when the app is already installed.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Lazy initializers read navigator/matchMedia during first client render —
  // no synchronous setState inside effects (eslint react-hooks rule).
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    typeof window !== "undefined" ? detectInstalled() : false,
  );
  const [isIos] = useState<boolean>(() =>
    typeof window !== "undefined" ? detectIos() : false,
  );
  const [isStandaloneMedia, setIsStandaloneMedia] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false,
  );

  useEffect(() => {
    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    const media = window.matchMedia("(display-mode: standalone)");
    const onMediaChange = (e: MediaQueryListEvent) => {
      setIsStandaloneMedia(e.matches);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    media.addEventListener("change", onMediaChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  const installed = isInstalled || isStandaloneMedia;
  const canPrompt = deferredPrompt !== null && !installed;

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
    return outcome;
  }, [deferredPrompt]);

  return {
    /** Native prompt is captured and ready (Chromium/Android/Desktop). */
    canPrompt,
    /** App already runs installed (standalone / home-screen). */
    isInstalled: installed,
    /** iOS device where only manual "Add to Home Screen" exists. */
    isIos,
    /** Fire the native install prompt. */
    promptInstall,
  };
}
