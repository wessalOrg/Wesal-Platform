"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import { ApiError, getApiFieldMessages, parseApiFieldErrors } from "@/lib/api-error";
import { REGISTER_LIMITS, getRegisterPasswordIssue } from "@/lib/register-validation";
import { resetPassword } from "@/services/auth";

type ResetPasswordFormCardProps = {
  email?: string;
  token?: string;
  invalidLink?: boolean;
};

type FieldKey = "newPassword" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function ResetPasswordFormCard({
  email,
  token,
  invalidLink,
}: ResetPasswordFormCardProps) {
  const t = useT();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    newPassword.length > 0 && confirmPassword.length > 0 && !pending;

  const passwordIssueMessage = (
    issue: ReturnType<typeof getRegisterPasswordIssue>,
  ): string => {
    switch (issue) {
      case "required":
        return t("auth.resetPassword.form.error.newPassword");
      case "min":
        return t("auth.register.form.error.passwordMin");
      case "max":
        return t("auth.register.form.error.passwordMax");
      case "upper":
        return t("auth.register.form.error.passwordUpper");
      case "lower":
        return t("auth.register.form.error.passwordLower");
      case "digit":
        return t("auth.register.form.error.passwordDigit");
      case "special":
        return t("auth.register.form.error.passwordSpecial");
      default:
        return t("auth.resetPassword.form.error.newPassword");
    }
  };

  const localizeApiFieldMessage = (field: FieldKey, message: string): string => {
    const lower = message.toLowerCase();
    if (field === "confirmPassword") {
      if (lower.includes("match")) return t("auth.register.form.error.passwordMismatch");
      if (lower.includes("required")) return t("auth.resetPassword.form.error.confirmPassword");
      return t("auth.register.form.error.passwordMismatch");
    }
    if (lower.includes("uppercase")) return t("auth.register.form.error.passwordUpper");
    if (lower.includes("lowercase")) return t("auth.register.form.error.passwordLower");
    if (lower.includes("digit") || lower.includes("number")) {
      return t("auth.register.form.error.passwordDigit");
    }
    if (lower.includes("special") || lower.includes("non.alphanumeric")) {
      return t("auth.register.form.error.passwordSpecial");
    }
    return passwordIssueMessage(getRegisterPasswordIssue(newPassword));
  };

  const validateField = (field: FieldKey, values: { newPassword: string; confirmPassword: string }): string | undefined => {
    if (field === "newPassword") {
      return passwordIssueMessage(getRegisterPasswordIssue(values.newPassword));
    }
    if (!values.confirmPassword) return t("auth.resetPassword.form.error.confirmPassword");
    if (values.newPassword !== values.confirmPassword) {
      return t("auth.register.form.error.passwordMismatch");
    }
    return undefined;
  };

  const validateAll = (): FieldErrors => {
    const errors: FieldErrors = {};
    const values = { newPassword, confirmPassword };
    (["newPassword", "confirmPassword"] as FieldKey[]).forEach((field) => {
      const message = validateField(field, values);
      if (message) errors[field] = message;
    });
    return errors;
  };

  const setFieldError = (field: FieldKey, message?: string) => {
    setFieldErrors((prev) => {
      if (!message) {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: message };
    });
  };

  const updateField = (field: FieldKey, value: string) => {
    const nextValues = {
      newPassword: field === "newPassword" ? value : newPassword,
      confirmPassword: field === "confirmPassword" ? value : confirmPassword,
    };
    if (field === "newPassword") setNewPassword(value);
    else setConfirmPassword(value);

    if (formError) setFormError(null);

    if (field === "newPassword" && confirmPassword) {
      setFieldError("confirmPassword", validateField("confirmPassword", nextValues));
      return;
    }
    if (value.length > 0 || fieldErrors[field]) {
      setFieldError(field, validateField(field, nextValues));
    }
  };

  const blurField = (field: FieldKey) => {
    setFieldError(field, validateField(field, { newPassword, confirmPassword }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const errors = validateAll();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await resetPassword({
        email: email ?? "",
        token: token ?? "",
        newPassword,
        confirmPassword,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = parseApiFieldErrors({ errors: err.fieldErrors });
        if (Object.keys(fieldErrors).length > 0) {
          const localized: FieldErrors = {};
          (Object.keys(fieldErrors) as FieldKey[]).forEach((field) => {
            const raw = fieldErrors[field]?.[0];
            if (raw) localized[field] = localizeApiFieldMessage(field, raw);
          });

          const hasNewPassword = Boolean(localized.newPassword);
          const hasConfirmPassword = Boolean(localized.confirmPassword);
          setFieldErrors(localized);
          if (hasNewPassword || hasConfirmPassword) {
            setFormError(null);
            return;
          }
        }

        if (getApiFieldMessages(err, "token").length > 0 || getApiFieldMessages(err, "Token").length > 0) {
          setFormError(t("auth.resetPassword.form.error.invalidLink"));
          return;
        }
      }

      const isNetworkFailure =
        !(err instanceof ApiError) ||
        !err.status ||
        err.message.toLowerCase().includes("network") ||
        err.message.toLowerCase().includes("timeout");

      setFormError(
        isNetworkFailure
          ? t("auth.resetPassword.form.error.network")
          : t("auth.resetPassword.form.error.generic"),
      );
    } finally {
      setPending(false);
    }
  };

  if (invalidLink) {
    return (
      <div data-testid="reset-password-invalid-link">
        <div className="rounded-xl bg-[#fdecea] px-4 py-3 text-center" role="alert">
          <p className="text-sm font-semibold text-[#b42318]">
            {t("auth.resetPassword.invalidLink.title")}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#475467]">
            {t("auth.resetPassword.invalidLink.message")}
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--wesal-muted)]">
          <Link
            href="/forgot-password"
            className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          >
            {t("auth.resetPassword.invalidLink.requestNew")}
          </Link>
          {" · "}
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

  if (submitted) {
    return (
      <div data-testid="reset-password-success">
        <div className="rounded-xl bg-[#ecfdf3] px-4 py-3 text-center" role="status">
          <p className="text-sm font-semibold text-[#027a48]">
            {t("auth.resetPassword.success.title")}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#475467]">
            {t("auth.resetPassword.success.message")}
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--wesal-muted)]">
          <Link
            href="/login"
            className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          >
            {t("auth.resetPassword.success.backToLogin")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div data-testid="reset-password-form">
      {formError ? (
        <p
          className="rounded-xl bg-[#fdecea] px-3 py-2 text-center text-sm text-[#b42318]"
          role="alert"
          data-testid="reset-password-form-error"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3.5" noValidate>
        <PasswordField
          label={t("auth.resetPassword.form.newPassword")}
          value={newPassword}
          onChange={(value) => updateField("newPassword", value)}
          onBlur={() => blurField("newPassword")}
          placeholder={t("auth.resetPassword.form.newPasswordPlaceholder")}
          error={fieldErrors.newPassword}
          autoComplete="new-password"
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((value) => !value)}
          showLabel={t("auth.register.form.showPassword")}
          hideLabel={t("auth.register.form.hidePassword")}
        />
        <PasswordField
          label={t("auth.resetPassword.form.confirmPassword")}
          value={confirmPassword}
          onChange={(value) => updateField("confirmPassword", value)}
          onBlur={() => blurField("confirmPassword")}
          placeholder={t("auth.resetPassword.form.confirmPasswordPlaceholder")}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          showPassword={showConfirmPassword}
          onToggleShow={() => setShowConfirmPassword((value) => !value)}
          showLabel={t("auth.register.form.showPassword")}
          hideLabel={t("auth.register.form.hidePassword")}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={pending || undefined}
          className="btn-primary wesal-auth-submit mt-1.5 w-full !min-h-12 !rounded-xl !text-base"
          data-testid="reset-password-submit"
        >
          {pending
            ? t("auth.resetPassword.form.submitting")
            : t("auth.resetPassword.form.submit")}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  autoComplete,
  showPassword,
  onToggleShow,
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
  autoComplete?: string;
  showPassword: boolean;
  onToggleShow: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <label className="block text-sm">
      <span
        className={`wesal-register-field-label mb-1.5 block ${error ? "wesal-register-field-label--error" : ""}`}
      >
        {label}
      </span>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={REGISTER_LIMITS.maxPasswordLength}
          aria-invalid={error ? true : undefined}
          className={`wesal-register-field-input w-full rounded-xl border px-3.5 py-2.5 pe-10 text-[0.95rem] outline-none transition focus:border-[var(--wesal-maroon)] ${
            error ? "wesal-register-field-input--error" : "border-[var(--wesal-border)]"
          }`}
        />
        <div className="absolute end-2 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={onToggleShow}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8a7a70] transition hover:bg-white/70 hover:text-[var(--wesal-maroon)]"
            aria-label={showPassword ? hideLabel : showLabel}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M3 3l18 18M10.58 10.58A2.5 2.5 0 0 0 12 15.5a2.5 2.5 0 0 0 1.42-.42M6.71 6.71C4.66 8.17 3.09 10.09 2.25 12c0 0 3.75 6.75 9.75 6.75 1.73 0 3.35-.45 4.77-1.24M17.94 17.94C19.34 16.54 20.91 14.62 21.75 12c0 0-1.57-1.92-3.62-3.29" strokeLinecap="round" />
    </svg>
  );
}