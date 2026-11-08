"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";

function subscribe() {
  return () => undefined;
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

type CoordinatorSetupPendingSuccessProps = {
  open?: boolean;
};

export default function CoordinatorSetupPendingSuccess({
  open = true,
}: CoordinatorSetupPendingSuccessProps) {
  const t = useT();
  const titleId = useId();
  const descriptionId = useId();
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const isClient = useIsClient();

  useEffect(() => {
    if (!open || !isClient) return;
    primaryRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector<HTMLElement>("[data-auth-shell]");
    if (shell) shell.setAttribute("inert", "");
    return () => {
      document.body.style.overflow = previousOverflow;
      shell?.removeAttribute("inert");
    };
  }, [open, isClient]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="wesal-register-success-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      data-testid="coordinator-setup-success-overlay"
    >
      <div className="wesal-register-success-backdrop absolute inset-0" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="wesal-register-success-card relative z-10 w-full max-w-[26rem] rounded-[1.75rem] bg-white px-6 py-8 text-center shadow-[0_24px_60px_rgba(60,35,30,0.28)] sm:max-w-[28.5rem] sm:px-9 sm:py-9"
        data-testid="coordinator-setup-pending-success"
      >
        <div
          className="mx-auto mb-1 flex h-[9.75rem] w-[12.5rem] items-center justify-center sm:h-[11rem] sm:w-[14rem]"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local success illustration asset */}
          <img
            src="/auth/coordinator-request-sent.png"
            alt=""
            width={280}
            height={168}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <h2
          id={titleId}
          className="wesal-text-bold mt-1 text-[1.45rem] font-extrabold leading-9 tracking-tight text-[var(--wesal-maroon)] sm:text-[1.65rem] sm:leading-10"
        >
          {t("auth.coordinator.setup.successTitle")}
        </h2>

        <p
          id={descriptionId}
          className="mx-auto mt-2.5 max-w-[22.5rem] text-[0.9rem] leading-7 text-[#9a8580] sm:max-w-[24rem] sm:text-[0.95rem] sm:leading-8"
        >
          {t("auth.coordinator.setup.successBody")}
        </p>

        <div className="mt-6 flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[#ead8d3] bg-[#faf4f2] px-4 py-3.5 text-start sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.8rem] font-semibold text-[#6d5a56]">
              {t("auth.coordinator.setup.statusLabel")}
            </p>
            <p className="mt-0.5 text-[0.95rem] font-bold text-[var(--wesal-maroon)]">
              {t("auth.coordinator.setup.statusPending")}
            </p>
          </div>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-[0_2px_10px_rgba(90,45,50,0.08)]"
            aria-hidden="true"
          >
            <ClockIcon />
          </span>
        </div>

        <Link
          ref={primaryRef}
          href="/profile"
          className="wesal-role-setup-btn wesal-text-bold mt-5 inline-flex w-full !min-h-[3.15rem] !rounded-[0.95rem] !text-[1rem] !shadow-[0_12px_28px_rgba(168,98,103,0.28)]"
          data-testid="coordinator-setup-home"
        >
          <HomeIcon />
          <span>{t("auth.pendingAccount.viewAccount")}</span>
        </Link>
      </div>
    </div>,
    document.body,
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <path
        d="M4.5 11.2 12 5l7.5 6.2V20a1 1 0 0 1-1 1h-4.2v-5.2H9.7V21H5.5a1 1 0 0 1-1-1v-8.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
