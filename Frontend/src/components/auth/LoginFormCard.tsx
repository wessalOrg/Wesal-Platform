"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { markAuthNavigation, navigateAfterAuth } from "@/lib/auth-nav";
import { useT } from "@/i18n";
import {
  ApiError,
  getAccountBlockedMinutes,
  isAccountBlockedError,
  isInvalidLoginCredentialsError,
  mapLoginApiFieldErrors,
} from "@/lib/api-error";
import {
  clearBookingHallContext,
  resolveAuthRedirect,
  setStoredAuth,
} from "@/lib/auth-storage";
import { setAccessToken } from "@/lib/auth-token";
import {
  detectLoginIdentifierKind,
  isValidLoginIdentifier,
  normalizeLoginIdentifier,
} from "@/lib/login-validation";
import { loginAccount } from "@/services/auth";

type LoginFormCardProps = {
  registerHref: string;
  redirectTo?: string;
  action?: string;
};

type FieldKey = "identifier" | "password";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function LoginFormCard({
  registerHref,
  redirectTo,
  action,
}: LoginFormCardProps) {
  const t = useT();
  const router = useRouter();
  const { applyLocalSession, refreshSession } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit =
    identifier.trim().length > 0 && password.length > 0 && !pending;

  const localizeApiFieldMessage = (field: FieldKey, message: string): string => {
    const lower = message.toLowerCase();
    if (field === "identifier") {
      if (lower.includes("required") || lower.includes("whitespace")) {
        return t("auth.login.form.error.identifier");
      }
      if (lower.includes("email")) {
        return t("auth.login.form.error.identifierEmail");
      }
      if (lower.includes("phone")) {
        return t("auth.login.form.error.identifierPhone");
      }
      return t("auth.login.form.error.identifierInvalid");
    }
    if (lower.includes("required")) {
      return t("auth.login.form.error.password");
    }
    return t("auth.login.form.error.passwordInvalid");
  };

  const validateField = (field: FieldKey, values: { identifier: string; password: string }) => {
    if (field === "identifier") {
      const value = values.identifier.trim();
      if (!value) return t("auth.login.form.error.identifier");
      if (!isValidLoginIdentifier(value)) return t("auth.login.form.error.identifierInvalid");
      return undefined;
    }
    if (!values.password) return t("auth.login.form.error.password");
    return undefined;
  };

  const validateAll = (): FieldErrors => {
    const values = { identifier, password };
    const errors: FieldErrors = {};
    (["identifier", "password"] as FieldKey[]).forEach((field) => {
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
    const previousIdentifier = identifier;
    const nextValues = {
      identifier: field === "identifier" ? value : identifier,
      password: field === "password" ? value : password,
    };

    if (field === "identifier") setIdentifier(value);
    else setPassword(value);

    if (formError) setFormError(null);

    if (
      field === "identifier" &&
      detectLoginIdentifierKind(previousIdentifier) !== detectLoginIdentifierKind(value)
    ) {
      setFieldError("identifier", validateField("identifier", nextValues));
      return;
    }

    if (value.length > 0 || fieldErrors[field]) {
      setFieldError(field, validateField(field, nextValues));
    }
  };

  const blurField = (field: FieldKey) => {
    setFieldError(field, validateField(field, { identifier, password }));
  };

  const resolveLoginErrorMessage = (error: ApiError): string => {
    if (isAccountBlockedError(error)) {
      const minutes = getAccountBlockedMinutes(error);
      if (minutes != null) {
        return t("auth.login.form.error.blocked", { minutes });
      }
      return t("auth.login.form.error.blockedGeneric");
    }

    if (isInvalidLoginCredentialsError(error)) {
      return t("auth.login.form.error.invalidCredentials");
    }

    const isNetworkFailure =
      !error.status ||
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("timeout");

    if (isNetworkFailure) {
      return t("auth.login.form.error.network");
    }

    return t("auth.login.form.error.generic");
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
      const result = await loginAccount({
        identifier: normalizeLoginIdentifier(identifier),
        password,
      });

      if (!result.token) {
        setFormError(t("auth.login.form.error.generic"));
        return;
      }

      setAccessToken(result.token);
      setStoredAuth({
        token: result.token,
        user: {
          id: result.id,
          name: result.fullName,
          email: result.email,
          phone: result.phoneNumber,
          role: result.role,
        },
      });
      applyLocalSession({
        isAuthenticated: true,
        role: result.role || null,
        userName: result.fullName || null,
      });
      void refreshSession();
      clearBookingHallContext();
      navigateAfterAuth(router, resolveAuthRedirect(redirectTo, action));
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(t("auth.login.form.error.generic"));
        return;
      }

      if (isAccountBlockedError(error)) {
        setFieldErrors({});
        setFormError(resolveLoginErrorMessage(error));
        return;
      }

      const apiFieldErrors = mapLoginApiFieldErrors(error);
      if (Object.keys(apiFieldErrors).length > 0) {
        const localized: FieldErrors = {};
        (Object.keys(apiFieldErrors) as FieldKey[]).forEach((field) => {
          const raw = apiFieldErrors[field];
          if (raw) localized[field] = localizeApiFieldMessage(field, raw);
        });
        setFieldErrors(localized);
        setFormError(null);
        return;
      }

      setFormError(resolveLoginErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div data-testid="login-form">
      {formError ? (
        <p
          className="rounded-xl bg-[#fdecea] px-3 py-2 text-center text-sm text-[#b42318]"
          role="alert"
          data-testid="login-form-error"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3.5" noValidate>
        <LoginField
          label={t("auth.login.form.username")}
          value={identifier}
          onChange={(value) => updateField("identifier", value)}
          onBlur={() => blurField("identifier")}
          placeholder={t("auth.login.form.usernamePlaceholder")}
          error={fieldErrors.identifier}
          autoComplete="username"
        />
        <LoginField
          label={t("auth.login.form.password")}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(value) => updateField("password", value)}
          onBlur={() => blurField("password")}
          placeholder={t("auth.login.form.passwordPlaceholder")}
          error={fieldErrors.password}
          autoComplete="current-password"
          trailing={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              label={
                showPassword
                  ? t("auth.login.form.hidePassword")
                  : t("auth.login.form.showPassword")
              }
            />
          }
        />

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={pending || undefined}
          className="btn-primary wesal-auth-submit mt-1.5 w-full !min-h-12 !rounded-xl !text-base"
          data-testid="login-submit"
        >
          {pending ? t("auth.login.form.submitting") : t("auth.login.form.submit")}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--wesal-muted)]">
        {t("auth.login.noAccount")}{" "}
        <Link
          href={registerHref}
          onClick={markAuthNavigation}
          className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
        >
          {t("auth.login.registerLink")}
        </Link>
      </p>
    </div>
  );
}

function LoginField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  type = "text",
  autoComplete,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  trailing?: ReactNode;
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
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={`wesal-register-field-input w-full rounded-xl border px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--wesal-maroon)] ${
            trailing ? "pe-10" : ""
          } ${error ? "wesal-register-field-input--error" : "border-[var(--wesal-border)]"}`}
        />
        {trailing ? <div className="absolute end-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function PasswordToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8a7a70] transition hover:bg-white/70 hover:text-[var(--wesal-maroon)]"
      aria-label={label}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
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
