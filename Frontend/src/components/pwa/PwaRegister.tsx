"use client";

import { useEffect, useState } from "react";
import { useTranslateLang } from "@/i18n";
import { langToDir } from "@/lib/language";

/**
 * Registers /sw.js in production only (dev keeps HMR untouched) and surfaces
 * a discreet "new version available" bar when a fresh SW takes over, so users
 * never get stuck on a stale bundle after a deployment.
 */
export default function PwaRegister() {
  const { lang, t } = useTranslateLang();
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let controller = navigator.serviceWorker.controller;
    const workerListeners = new Map<ServiceWorker, () => void>();

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker || workerListeners.has(worker)) return;
      const replacingExistingWorker = Boolean(
        (controller && controller !== worker) ||
        (registration?.active && registration.active !== worker),
      );
      const onStateChange = () => {
        if (!cancelled && worker.state === "installed" && replacingExistingWorker) setUpdateReady(true);
        if (["installed", "activated", "redundant"].includes(worker.state)) {
          worker.removeEventListener("statechange", onStateChange);
          workerListeners.delete(worker);
        }
      };
      workerListeners.set(worker, onStateChange);
      worker.addEventListener("statechange", onStateChange);
      onStateChange();
    };

    const onUpdateFound = () => {
      watchWorker(registration?.installing ?? null);
    };

    const onControllerChange = () => {
      const next = navigator.serviceWorker.controller;
      if (!next || next === controller) return;
      // The first claim establishes control; only replacing a controller is an update.
      if (!cancelled && controller) setUpdateReady(true);
      controller = next;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
    };
    // Listen before register resolves so a fast initial claim cannot be missed.
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibility);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        reg.addEventListener("updatefound", onUpdateFound);
        watchWorker(reg.installing);
        watchWorker(reg.waiting);
      })
      .catch(() => {
        /* SW unsupported/blocked — site works normally without it */
      });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      document.removeEventListener("visibilitychange", onVisibility);
      workerListeners.forEach((listener, worker) => worker.removeEventListener("statechange", listener));
      workerListeners.clear();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!updateReady) return null;

  const applyUpdate = () => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage("WESAL_SKIP_WAITING");
        }
      }).catch(() => undefined).finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  // Root layer: above the floating assistant (105), below portaled booking dialogs (160).
  return (
    <div
      role="status"
      dir={langToDir(lang)}
      lang={lang}
      data-testid="pwa-update-banner"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-center px-4 pb-4"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 shadow-[0_18px_40px_rgba(90,55,45,0.16)]">
        <p className="text-xs font-semibold text-[var(--wesal-text)]">
          {t("pwa.updateAvailable")}
        </p>
        <button
          type="button"
          onClick={applyUpdate}
          className="btn-primary min-h-10 shrink-0 px-4 text-xs"
        >
          {t("pwa.updateAction")}
        </button>
      </div>
    </div>
  );
}
