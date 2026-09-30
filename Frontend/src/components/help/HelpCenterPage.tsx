"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useHelpCenterTickets } from "@/hooks/useHelpCenterTickets";
import { getCurrentUserId } from "@/lib/current-user";
import { HELP_CENTER_MAX_LENGTH } from "@/types/help-center";
import { useT } from "@/i18n";

export default function HelpCenterPage() {
  const t = useT();
  const { status } = useAuth();
  const identity = useUserIdentity();
  const { submitQuestion } = useHelpCenterTickets();
  const [message, setMessage] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const authReady = status === "ready" && identity.ready;
  const isGuest = authReady && !identity.authenticated;
  const canSubmit = authReady && identity.authenticated && !submitting;

  const length = message.length;
  const trimmed = message.trim();

  const loginHref = useMemo(
    () => `/login?redirect=${encodeURIComponent("/help")}`,
    [],
  );
  const registerHref = useMemo(
    () => `/register?redirect=${encodeURIComponent("/help")}`,
    [],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorKey(null);
    setSuccess(false);

    if (!authReady) return;

    if (!identity.authenticated) {
      setErrorKey("help.authRequired");
      return;
    }

    if (!trimmed) {
      setErrorKey("help.errors.empty");
      return;
    }

    if (trimmed.length > HELP_CENTER_MAX_LENGTH) {
      setErrorKey("help.errors.tooLong");
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      setErrorKey("help.authRequired");
      return;
    }

    setSubmitting(true);
    try {
      submitQuestion({
        userId,
        userName: identity.displayName || t("common.user"),
        question: trimmed,
      });
      setMessage("");
      setSuccess(true);
    } catch {
      setErrorKey("help.errors.submitFailed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main
        className="container-wesal min-h-[70svh] py-10 sm:py-14"
        data-testid="help-center-page"
      >
        <section className="w-full rounded-[1.75rem] border border-[var(--wesal-border)] bg-white p-5 shadow-[0_14px_36px_rgba(90,55,45,0.06)] sm:p-8 lg:p-10">
          <div className="grid items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-14">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-[var(--wesal-maroon)] sm:text-3xl">
                {t("help.title")}
              </h1>
              <p className="mt-2 text-lg font-bold text-[var(--wesal-text)]">
                {t("help.subtitle")}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)] sm:text-base">
                {t("help.lead")}
              </p>

              {isGuest ? (
                <div
                  className="mt-6 rounded-2xl border border-[#f5c6c2] bg-[#fdecea] px-4 py-4"
                  role="alert"
                  data-testid="help-center-auth-required"
                >
                  <p className="text-sm font-bold text-[#b42318]">{t("help.authRequiredTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-[#8a3a35]">
                    {t("help.authRequiredBody")}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link href={loginHref} className="btn-primary min-h-11 flex-1 justify-center">
                      {t("nav.login")}
                    </Link>
                    <Link href={registerHref} className="btn-outline min-h-11 flex-1 justify-center">
                      {t("nav.register")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <form className="flex min-w-0 flex-col gap-4" onSubmit={onSubmit} noValidate>
              <label className="block">
                <span className="sr-only">{t("help.messageLabel")}</span>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setSuccess(false);
                    setErrorKey(null);
                    setMessage(event.target.value.slice(0, HELP_CENTER_MAX_LENGTH));
                  }}
                  rows={8}
                  maxLength={HELP_CENTER_MAX_LENGTH}
                  placeholder={t("help.placeholder")}
                  className="min-h-[14rem] w-full resize-y rounded-2xl border border-[var(--wesal-border)] bg-[#faf7f4] px-4 py-3 text-sm leading-7 text-[var(--wesal-text)] outline-none transition focus:border-[var(--wesal-maroon)] md:min-h-[16rem]"
                  data-testid="help-center-message"
                  disabled={submitting}
                />
              </label>
              <div className="flex justify-end text-xs font-semibold tabular-nums text-[var(--wesal-muted)]">
                {length}/{HELP_CENTER_MAX_LENGTH}
              </div>

              {errorKey && !isGuest ? (
                <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
                  {t(errorKey)}
                </p>
              ) : null}

              {success ? (
                <p
                  className="rounded-xl border border-[#c8e6c9] bg-[#e8f5e9] px-3 py-3 text-sm leading-6 text-[#1b5e20]"
                  role="status"
                  data-testid="help-center-success"
                >
                  {t("help.success")}
                </p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[12rem]"
                  disabled={!canSubmit || isGuest}
                  aria-busy={submitting || undefined}
                  data-testid="help-center-submit"
                >
                  <SendIcon />
                  {submitting ? t("help.submitting") : t("help.submit")}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true">
      <path d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L14.5 12 3.3 13.9z" />
    </svg>
  );
}
