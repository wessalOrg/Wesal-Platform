"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
  clearRememberedEmail,
  getRememberedEmail,
  isRememberMeEnabled,
  setRememberedEmail,
  setRememberMeEnabled,
} from "@/lib/auth-persist";
import {
  clearBookingHallContext,
  resolveAuthRedirect,
  setStoredAuth,
} from "@/lib/auth-storage";
import { setAccessToken } from "@/lib/auth-token";
import { isValidLoginEmail } from "@/lib/login-validation";
import { loginAccount } from "@/services/auth";

type LoginFormCardProps = {
  registerHref: string;
  redirectTo?: string;
  action?: string;
};

type FieldKey = "email" | "password";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function LoginFormCard({
  registerHref,
  redirectTo,
  action,
}: LoginFormCardProps) {
  const t = useT();
  const router = useRouter();
  const { applyLocalSession, refreshSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const remembered = getRememberedEmail();
      const preferRemember = isRememberMeEnabled() || Boolean(remembered);
      setRememberMe(preferRemember);
      if (remembered) setEmail(remembered);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

  const persistRememberPreference = (enabled: boolean, nextEmail: string) => {
    setRememberMeEnabled(enabled);
    if (enabled) setRememberedEmail(nextEmail);
    else clearRememberedEmail();
  };

  const localizeApiFieldMessage = (field: FieldKey, message: string): string => {
    const lower = message.toLowerCase();
    if (field === "email") {
      if (lower.includes("required") || lower.includes("whitespace")) {
        return t("auth.login.form.error.email");
      }
      if (lower.includes("email")) {
        return t("auth.login.form.error.emailInvalid");
      }
      return t("auth.login.form.error.emailInvalid");
    }
    if (lower.includes("required")) {
      return t("auth.login.form.error.password");
    }
    return t("auth.login.form.error.passwordInvalid");
  };

  const validateField = (field: FieldKey, values: { email: string; password: string }) => {
    if (field === "email") {
      const value = values.email.trim();
      if (!value) return t("auth.login.form.error.email");
      if (!isValidLoginEmail(value)) return t("auth.login.form.error.emailInvalid");
      return undefined;
    }
    if (!values.password) return t("auth.login.form.error.password");
    return undefined;
  };

  const validateAll = (): FieldErrors => {
    const values = { email, password };
    const errors: FieldErrors = {};
    (["email", "password"] as FieldKey[]).forEach((field) => {
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
      email: field === "email" ? value : email,
      password: field === "password" ? value : password,
    };

    if (field === "email") setEmail(value);
    else setPassword(value);

    if (formError) setFormError(null);

    if (value.length > 0 || fieldErrors[field]) {
      setFieldError(field, validateField(field, nextValues));
    }
  };

  const blurField = (field: FieldKey) => {
    setFieldError(field, validateField(field, { email, password }));
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
        email: email.trim(),
        password,
      });

      if (!result.token) {
        setFormError(t("auth.login.form.error.generic"));
        return;
      }

      persistRememberPreference(rememberMe, email.trim());
      setAccessToken(result.token);
      setStoredAuth({
        token: result.token,
        user: {
          id: result.id,
          name: result.fullName,
          email: result.email,
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
          label={t("auth.login.form.email")}
          type="email"
          value={email}
          onChange={(value) => updateField("email", value)}
          onBlur={() => blurField("email")}
          placeholder={t("auth.login.form.emailPlaceholder")}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <LoginField
          label={t("auth.login.form.password")}
          type="password"
          value={password}
          onChange={(value) => updateField("password", value)}
          onBlur={() => blurField("password")}
          placeholder={t("auth.login.form.passwordPlaceholder")}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--wesal-maroon-dark)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 accent-[var(--wesal-maroon)]"
              data-testid="login-remember-me"
            />
            <span>{t("auth.login.form.rememberMe")}</span>
          </label>
          <Link
            href="/forgot-password"
            onClick={markAuthNavigation}
            className="shrink-0 text-sm font-medium text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          >
            {t("auth.login.forgotPassword")}
          </Link>
        </div>

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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
  type?: string;
  autoComplete?: string;
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
            error ? "wesal-register-field-input--error" : "border-[var(--wesal-border)]"
          }`}
        />
      </div>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

