"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import { ApiError, hasApiFieldError } from "@/lib/api-error";
import { REGISTER_LIMITS } from "@/lib/register-validation";
import { forgotPassword } from "@/services/auth";

export default function ForgotPasswordFormCard() {
  const t = useT();

  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = email.trim().length > 0 && !pending;

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return t("auth.forgotPassword.form.error.email");
    if (!isValidEmail(value)) return t("auth.forgotPassword.form.error.emailInvalid");
    return undefined;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (formError) setFormError(null);
    if (value.length > 0 || fieldErrors.email) {
      setFieldErrors((prev) => {
        const message = validateEmail(value);
        if (!message) {
          if (!prev.email) return prev;
          const next = { ...prev };
          delete next.email;
          return next;
        }
        return { ...prev, email: message };
      });
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      setFormError(null);
      return;
    }

    setPending(true);
    setFormError(null);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError && hasApiFieldError(error, "email")) {
        setFieldErrors({ email: t("auth.forgotPassword.form.error.emailInvalid") });
        setFormError(null);
        return;
      }

      const isNetworkFailure =
        !(error instanceof ApiError) ||
        !error.status ||
        error.message.toLowerCase().includes("network") ||
        error.message.toLowerCase().includes("timeout");

      setFormError(
        isNetworkFailure
          ? t("auth.forgotPassword.form.error.network")
          : t("auth.forgotPassword.form.error.generic"),
      );
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <div data-testid="forgot-password-success">
        <div className="rounded-xl bg-[#ecfdf3] px-4 py-3 text-center" role="status">
          <p className="text-sm font-semibold text-[#027a48]">
            {t("auth.forgotPassword.success.title")}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#475467]">
            {t("auth.forgotPassword.success.message", { email: email.trim() })}
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--wesal-muted)]">
          <Link
            href="/login"
            className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          >
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div data-testid="forgot-password-form">
      {formError ? (
        <p
          className="rounded-xl bg-[#fdecea] px-3 py-2 text-center text-sm text-[#b42318]"
          role="alert"
          data-testid="forgot-password-form-error"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3.5" noValidate>
        <label className="block text-sm">
          <span
            className={`wesal-register-field-label mb-1.5 block ${fieldErrors.email ? "wesal-register-field-label--error" : ""}`}
          >
            {t("auth.forgotPassword.form.email")}
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            placeholder={t("auth.forgotPassword.form.emailPlaceholder")}
            autoComplete="email"
            autoFocus
            maxLength={REGISTER_LIMITS.maxEmailLength}
            aria-invalid={fieldErrors.email ? true : undefined}
            className={`wesal-register-field-input w-full rounded-xl border px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--wesal-maroon)] ${
              fieldErrors.email ? "wesal-register-field-input--error" : "border-[var(--wesal-border)]"
            }`}
          />
          {fieldErrors.email ? (
            <span className="mt-1 block text-xs font-medium text-[#b42318]" role="alert">
              {fieldErrors.email}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={pending || undefined}
          className="btn-primary wesal-auth-submit mt-1.5 w-full !min-h-12 !rounded-xl !text-base"
          data-testid="forgot-password-submit"
        >
          {pending
            ? t("auth.forgotPassword.form.submitting")
            : t("auth.forgotPassword.form.submit")}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--wesal-muted)]">
        <Link
          href="/login"
          className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
        >
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </p>
    </div>
  );
}

function isValidEmail(value: string): boolean {
  return value.trim().length <= REGISTER_LIMITS.maxEmailLength && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}