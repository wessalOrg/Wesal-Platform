"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import RoleRegistrationStepper from "@/components/auth/role-setup/RoleRegistrationStepper";
import WesalLogo from "@/components/brand/WesalLogo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import {
  ApiError,
  getRegisterConflictKind,
  isInvalidAccountTypeError,
  mapRegisterApiFieldErrors,
} from "@/lib/api-error";
import { resolveRoleSetupPath } from "@/lib/account-profile-path";
import {
  accountTypeRequiresRoleSetup,
  clearStoredAccountType,
  type AccountType,
} from "@/lib/account-type";
import { markAuthNavigation, navigateAfterAuth } from "@/lib/auth-nav";
import { setStoredAuth } from "@/lib/auth-storage";
import { setAccessToken } from "@/lib/auth-token";
import {
  getRegisterPasswordIssue,
  REGISTER_LIMITS,
} from "@/lib/register-validation";
import { registerAccount } from "@/services/auth";
import "./role-setup.css";

type FieldKey = "fullName" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

type RoleSetupBasicDataFormProps = {
  accountType: AccountType;
  loginHref: string;
  onBack: () => void;
  onInvalidAccountType?: (message: string) => void;
};

export default function RoleSetupBasicDataForm({
  accountType,
  loginHref,
  onBack,
  onInvalidAccountType,
}: RoleSetupBasicDataFormProps) {
  const t = useT();
  const router = useRouter();
  const { applyLocalSession, refreshSession } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showConflictLogin, setShowConflictLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const [slowServer, setSlowServer] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlowServer(true), 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const values = { fullName, email, password, confirmPassword };

  const passwordIssueMessage = (issue: ReturnType<typeof getRegisterPasswordIssue>) => {
    switch (issue) {
      case "required":
        return t("auth.register.form.error.password");
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
        return undefined;
    }
  };

  const validateField = (field: FieldKey, next = values): string | undefined => {
    switch (field) {
      case "fullName":
        if (!next.fullName.trim()) return t("auth.register.form.error.fullName");
        if (next.fullName.trim().length > REGISTER_LIMITS.maxFullNameLength) {
          return t("auth.register.form.error.fullNameMax");
        }
        return undefined;
      case "email": {
        const emailValue = next.email.trim();
        if (!emailValue) return t("auth.register.form.error.email");
        if (!emailValue.includes("@")) return t("auth.register.form.error.emailMissingAt");
        if (emailValue.length > REGISTER_LIMITS.maxEmailLength) {
          return t("auth.register.form.error.emailMax");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
          return t("auth.register.form.error.emailInvalid");
        }
        return undefined;
      }
      case "password":
        return passwordIssueMessage(getRegisterPasswordIssue(next.password));
      case "confirmPassword":
        if (!next.confirmPassword) return t("auth.register.form.error.confirmPassword");
        if (next.password !== next.confirmPassword) {
          return t("auth.register.form.error.passwordMismatch");
        }
        return undefined;
      default:
        return undefined;
    }
  };

  const setFieldError = (field: FieldKey, message?: string) => {
    setFieldErrors((prev) => {
      if (!message) {
        if (!prev[field]) return prev;
        const copy = { ...prev };
        delete copy[field];
        return copy;
      }
      return { ...prev, [field]: message };
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const errors: FieldErrors = {};
    (["fullName", "email", "password", "confirmPassword"] as FieldKey[]).forEach((field) => {
      const message = validateField(field);
      if (message) errors[field] = message;
    });
    setFieldErrors(errors);
    setFormError(null);
    setShowConflictLogin(false);
    if (Object.keys(errors).length > 0) return;

    setSlowServer(false);
    setPending(true);
    try {
      const result = await registerAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        accountType,
      });

      clearStoredAccountType();

      const setupPath =
        resolveRoleSetupPath(result.accountType) ??
        resolveRoleSetupPath(result.role) ??
        (accountTypeRequiresRoleSetup(accountType)
          ? resolveRoleSetupPath(accountType)
          : null);

      if (!setupPath || !result.token) {
        setFormError(t("auth.register.form.error.generic"));
        return;
      }

      setAccessToken(result.token);
      setStoredAuth({
        token: result.token,
        user: {
          id: result.id,
          name: result.fullName,
          email: result.email,
          role: result.role,
          accountType: result.accountType,
        },
      });
      applyLocalSession({
        isAuthenticated: true,
        role: result.role || null,
        userName: result.fullName || null,
      });
      void refreshSession();
      navigateAfterAuth(router, setupPath);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(t("auth.register.form.error.generic"));
        return;
      }
      if (isInvalidAccountTypeError(error)) {
        const message = t("auth.register.form.error.accountTypeInvalid");
        setFormError(message);
        onInvalidAccountType?.(message);
        return;
      }
      const conflictKind = getRegisterConflictKind(error);
      if (conflictKind) {
        setShowConflictLogin(true);
        if (conflictKind === "email") {
          const message = t("auth.register.form.error.emailDuplicate");
          setFieldError("email", message);
          setFormError(message);
        } else {
          setFormError(t("auth.register.form.error.conflict"));
        }
        return;
      }
      const apiFieldErrors = mapRegisterApiFieldErrors(error);
      if (Object.keys(apiFieldErrors).length > 0) {
        const localized: FieldErrors = {};
        (Object.keys(apiFieldErrors) as FieldKey[]).forEach((field) => {
          const raw = apiFieldErrors[field];
          if (raw) localized[field] = raw;
        });
        setFieldErrors((prev) => ({ ...prev, ...localized }));
        setFormError(Object.values(localized)[0] ?? t("auth.register.form.error.generic"));
        return;
      }
      setFormError(
        !error.status || error.message.toLowerCase().includes("network")
          ? t("auth.register.form.error.network")
          : t("auth.register.form.error.generic"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="wesal-role-setup-card w-full rounded-[1.35rem] border border-white/70 bg-white p-5 shadow-[0_18px_48px_rgba(60,35,30,0.16)] sm:p-6"
      data-testid="role-setup-basic-data"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-8 w-auto sm:h-9" variant="brand" />
        <h1 className="wesal-text-bold mt-3 text-xl font-extrabold text-[var(--wesal-maroon)] sm:text-2xl">
          {t("auth.roleSetup.basicTitle")}
        </h1>
        <p className="mt-1.5 max-w-[24rem] text-sm font-medium leading-6 text-[var(--wesal-muted)]">
          {t("auth.roleSetup.basicSubtitle")}
        </p>
      </div>

      <RoleRegistrationStepper activeStep={2} />

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-5 space-y-3.5"
        noValidate
      >
        <Field
          id="role-full-name"
          label={t("auth.roleSetup.fullName")}
          required
          error={fieldErrors.fullName}
        >
          <IconInput
            id="role-full-name"
            value={fullName}
            placeholder={t("auth.roleSetup.fullNamePlaceholder")}
            maxLength={REGISTER_LIMITS.maxFullNameLength}
            autoComplete="name"
            hasError={Boolean(fieldErrors.fullName)}
            icon={<UserIcon />}
            onChange={(value) => {
              setFullName(value);
              setFieldError("fullName", validateField("fullName", { ...values, fullName: value }));
            }}
          />
        </Field>

        <Field
          id="role-email"
          label={t("auth.register.form.email")}
          required
          error={fieldErrors.email}
        >
          <IconInput
            id="role-email"
            type="email"
            value={email}
            placeholder={t("auth.roleSetup.emailPlaceholder")}
            maxLength={REGISTER_LIMITS.maxEmailLength}
            autoComplete="email"
            hasError={Boolean(fieldErrors.email)}
            icon={<MailIcon />}
            onChange={(value) => {
              setEmail(value);
              setFieldError("email", validateField("email", { ...values, email: value }));
            }}
          />
        </Field>

        <Field
          id="role-password"
          label={t("auth.register.form.password")}
          required
          error={fieldErrors.password}
        >
          <IconInput
            id="role-password"
            type={showPassword ? "text" : "password"}
            value={password}
            placeholder={t("auth.register.form.passwordPlaceholder")}
            maxLength={REGISTER_LIMITS.maxPasswordLength}
            autoComplete="new-password"
            hasError={Boolean(fieldErrors.password)}
            icon={<LockIcon />}
            trailing={
              <button
                type="button"
                className="text-[var(--wesal-muted)]"
                aria-label={
                  showPassword
                    ? t("auth.register.form.hidePassword")
                    : t("auth.register.form.showPassword")
                }
                onClick={() => setShowPassword((v) => !v)}
              >
                <EyeIcon open={showPassword} />
              </button>
            }
            onChange={(value) => {
              setPassword(value);
              const next = { ...values, password: value };
              setFieldError("password", validateField("password", next));
              if (confirmPassword) {
                setFieldError("confirmPassword", validateField("confirmPassword", next));
              }
            }}
          />
        </Field>

        <Field
          id="role-confirm-password"
          label={t("auth.register.form.confirmPassword")}
          required
          error={fieldErrors.confirmPassword}
        >
          <IconInput
            id="role-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            placeholder={t("auth.register.form.confirmPasswordPlaceholder")}
            maxLength={REGISTER_LIMITS.maxPasswordLength}
            autoComplete="new-password"
            hasError={Boolean(fieldErrors.confirmPassword)}
            icon={<LockIcon />}
            trailing={
              <button
                type="button"
                className="text-[var(--wesal-muted)]"
                aria-label={
                  showConfirmPassword
                    ? t("auth.register.form.hidePassword")
                    : t("auth.register.form.showPassword")
                }
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            }
            onChange={(value) => {
              setConfirmPassword(value);
              setFieldError(
                "confirmPassword",
                validateField("confirmPassword", { ...values, confirmPassword: value }),
              );
            }}
          />
        </Field>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_28%,var(--wesal-border))] bg-[color-mix(in_srgb,var(--wesal-pink)_55%,white)] px-3.5 py-3 text-start">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--wesal-maroon)] text-white"
              aria-hidden="true"
            >
              !
            </span>
            <div>
              <p className="wesal-text-bold text-sm font-extrabold text-[var(--wesal-maroon)]">
                {t("auth.roleSetup.noteTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--wesal-muted)] sm:text-sm sm:leading-6">
                {t("auth.roleSetup.noteBody")}
              </p>
            </div>
          </div>
        </div>

        {formError ? (
          <p className="text-center text-sm font-medium text-[#b42318]" role="alert">
            {formError}
            {showConflictLogin ? (
              <>
                {" "}
                <Link
                  href={loginHref}
                  onClick={markAuthNavigation}
                  className="font-semibold underline underline-offset-2"
                >
                  {t("auth.register.form.error.conflictLogin")}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {pending && slowServer ? (
          <p className="text-center text-xs text-[var(--wesal-muted)]" role="status">
            {t("auth.form.serverWaking")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="wesal-role-setup-btn wesal-text-bold flex-[1.55] !text-base"
            data-testid="role-setup-basic-continue"
          >
            <span>
              {pending ? t("auth.register.form.submitting") : t("auth.register.continue")}
            </span>
            {!pending ? <span aria-hidden="true">←</span> : null}
          </button>
          <button
            type="button"
            className="wesal-role-setup-btn-outline flex-1"
            onClick={onBack}
            disabled={pending}
            data-testid="role-setup-basic-back"
          >
            <span aria-hidden="true">→</span>
            {t("auth.roleSetup.back")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
        {label}
        {required ? (
          <span className="ms-1 text-[#c45b55]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  autoComplete,
  hasError,
  icon,
  trailing,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  hasError: boolean;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute start-3.5 top-1/2 z-[1] -translate-y-1/2 text-[var(--wesal-maroon)]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "wesal-role-setup-input wesal-role-setup-input--icon-start",
          trailing ? "wesal-role-setup-input--icon-end" : "",
          hasError ? "wesal-role-setup-input--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {trailing ? (
        <div className="absolute end-3 top-1/2 z-[1] -translate-y-1/2">{trailing}</div>
      ) : null}
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c1.1-3 3.4-4.6 6.5-4.6s5.4 1.6 6.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4.2 7.3 7.8 5.3 7.8-5.3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
        <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
