"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { markAuthNavigation } from "@/lib/auth-nav";
import { useT } from "@/i18n";

type RegisterSuccessModalProps = {
  open: boolean;
  loginHref: string;
};

function subscribe() {
  return () => undefined;
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export default function RegisterSuccessModal({ open, loginHref }: RegisterSuccessModalProps) {
  const t = useT();
  const titleId = useId();
  const descriptionId = useId();
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const fallbackRef = useRef<HTMLAnchorElement>(null);
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;

    primaryRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const shell = document.querySelector<HTMLElement>("[data-auth-shell]");
    if (shell) shell.setAttribute("inert", "");

    return () => {
      document.body.style.overflow = previousOverflow;
      shell?.removeAttribute("inert");
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [primaryRef.current, fallbackRef.current].filter(
      (node): node is HTMLAnchorElement => Boolean(node),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="wesal-register-success-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      data-testid="register-success-overlay"
      onKeyDown={onKeyDown}
    >
      <div className="wesal-register-success-backdrop absolute inset-0" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="wesal-register-success-card relative z-10 w-full max-w-[22rem] rounded-[1.6rem] bg-white px-6 py-8 text-center shadow-[0_24px_60px_rgba(60,35,30,0.28)] sm:max-w-[24rem] sm:px-8 sm:py-9"
        data-testid="register-success-modal"
      >
        <div
          className="wesal-register-success-icon mx-auto h-[6.75rem] w-[6.75rem] overflow-hidden rounded-full sm:h-[7.5rem] sm:w-[7.5rem]"
          aria-hidden="true"
        >
          <img
            src="/auth/register-success-groom.png"
            alt=""
            width={160}
            height={160}
            className="h-full w-full scale-[1.22] object-cover object-[center_12%]"
            draggable={false}
          />
        </div>

        <h2
          id={titleId}
          className="mt-5 text-[1.35rem] font-extrabold leading-8 text-[#3f2a2c] sm:text-[1.5rem] sm:leading-9"
        >
          <span className="block">{t("auth.register.success.title")}</span>
          <span className="mt-1 block text-[1.05rem] font-bold text-[#5c3a3e] sm:text-[1.15rem]">
            {t("auth.register.success.subtitle")}
          </span>
        </h2>

        <p
          id={descriptionId}
          className="mt-3 whitespace-pre-line text-sm leading-7 text-[#7a6a66] sm:text-[0.95rem] sm:leading-8"
        >
          {t("auth.register.success.body")}
        </p>

        <Link
          ref={primaryRef}
          href={loginHref}
          onClick={markAuthNavigation}
          className="btn-primary mt-7 inline-flex w-full !min-h-12 items-center justify-center !rounded-xl !text-[0.98rem]"
          data-testid="register-success-start"
        >
          {t("auth.register.success.cta")}
        </Link>

        <Link
          ref={fallbackRef}
          href={loginHref}
          onClick={markAuthNavigation}
          className="mt-3 inline-flex text-sm font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          data-testid="register-success-login-fallback"
        >
          {t("auth.register.success.loginFallback")}
        </Link>
      </div>
    </div>,
    document.body,
  );
}
