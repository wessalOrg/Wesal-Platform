"use client";

import { useEffect, useState } from "react";

/**
 * Registers /sw.js in production only (dev keeps HMR untouched) and surfaces
 * a discreet "new version available" bar when a fresh SW takes over, so users
 * never get stuck on a stale bundle after a deployment.
 */
export default function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          if (!cancelled) setUpdateReady(true);
        }
      });
    };

    const onControllerChange = () => {
      // A newer SW claimed the page — a reload loads the fresh bundle.
      if (!cancelled) setUpdateReady(true);
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        reg.addEventListener("updatefound", onUpdateFound);
        // Proactively check on visibility return (new deploy while tab open).
        const onVisibility = () => {
          if (document.visibilityState === "visible") void reg.update();
        };
        document.addEventListener("visibilitychange", onVisibility);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          onControllerChange,
        );
      })
      .catch(() => {
        /* SW unsupported/blocked — site works normally without it */
      });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!updateReady) return null;

  const applyUpdate = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage("WESAL_SKIP_WAITING");
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      dir="rtl"
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4"
    >
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 shadow-[0_18px_40px_rgba(90,55,45,0.16)]">
        <p className="text-xs font-semibold text-[var(--wesal-text)]">
          تتوفر نسخة جديدة من وصال
        </p>
        <button
          type="button"
          onClick={applyUpdate}
          className="btn-primary min-h-10 shrink-0 px-4 text-xs"
        >
          تحديث
        </button>
      </div>
    </div>
  );
}
