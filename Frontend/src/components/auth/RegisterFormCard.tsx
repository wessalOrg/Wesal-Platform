"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import RegisterSuccessModal from "@/components/auth/RegisterSuccessModal";
import { markAuthNavigation } from "@/lib/auth-nav";
import { useT } from "@/i18n";
import {
  ApiError,
  getRegisterConflictKind,
  isInvalidAccountTypeError,
  mapRegisterApiFieldErrors,
} from "@/lib/api-error";
import {
  clearStoredAccountType,
  readStoredAccountType,
  type AccountType,
} from "@/lib/account-type";
import {
  getRegisterPasswordIssue,
  isValidRegisterPhone,
  normalizeRegisterPhone,
  REGISTER_LIMITS,
} from "@/lib/register-validation";
import { registerAccount } from "@/services/auth";

type RegisterFormCardProps = {
  accountType: AccountType | null;
  onRequireAccountType?: () => void;
  onInvalidAccountType?: (message: string) => void;
  loginHref: string;
  previewSuccess?: boolean;
};

type FieldKey = "fullName" | "email" | "phoneNumber" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

type FieldValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterFormCard({
  accountType,
  onRequireAccountType,
  onInvalidAccountType,
  loginHref,
  previewSuccess = false,
}: RegisterFormCardProps) {
  const t = useT();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showConflictLogin, setShowConflictLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(previewSuccess);

  const canSubmit =
    Boolean(accountType) &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phoneNumber.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !pending &&
    !success;

  const fieldValues: FieldValues = {
    fullName,
    email,
    phoneNumber,
    password,
    confirmPassword,
  };

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

  const localizeRegisterApiFieldMessage = (field: FieldKey, message: string): string => {
    const lower = message.toLowerCase();

    if (field === "password") {
      if (lower.includes("uppercase")) return t("auth.register.form.error.passwordUpper");
      if (lower.includes("lowercase")) return t("auth.register.form.error.passwordLower");
      if (lower.includes("number") || lower.includes("digit")) {
        return t("auth.register.form.error.passwordDigit");
      }
      if (lower.includes("non-alphanumeric") || lower.includes("special")) {
        return t("auth.register.form.error.passwordSpecial");
      }
      if (lower.includes("at least") || lower.includes("minimum") || lower.includes("8")) {
        return t("auth.register.form.error.passwordMin");
      }
      if (lower.includes("exceed") || lower.includes("maximum") || lower.includes("long")) {
        return t("auth.register.form.error.passwordMax");
      }
      if (lower.includes("required")) return t("auth.register.form.error.password");
      return t("auth.register.form.error.passwordMin");
    }

    if (field === "confirmPassword") {
      if (lower.includes("match")) return t("auth.register.form.error.passwordMismatch");
      if (lower.includes("required")) return t("auth.register.form.error.confirmPassword");
      return t("auth.register.form.error.passwordMismatch");
    }

    if (field === "email") {
      if (lower.includes("required")) return t("auth.register.form.error.email");
      return t("auth.register.form.error.emailInvalid");
    }

    if (field === "phoneNumber") {
      if (lower.includes("required")) return t("auth.register.form.error.phone");
      return t("auth.register.form.error.phoneInvalid");
    }

    if (field === "fullName") {
      if (lower.includes("exceed") || lower.includes("maximum") || lower.includes("long")) {
        return t("auth.register.form.error.fullNameMax");
      }
      return t("auth.register.form.error.fullName");
    }

    return t("auth.register.form.error.generic");
  };

  const validateField = (field: FieldKey, values: FieldValues): string | undefined => {
    switch (field) {
      case "fullName":
        if (!values.fullName.trim()) return t("auth.register.form.error.fullName");
        if (values.fullName.trim().length > REGISTER_LIMITS.maxFullNameLength) {
          return t("auth.register.form.error.fullNameMax");
        }
        return undefined;
      case "email": {
        const emailValue = values.email.trim();
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
      case "phoneNumber":
        if (!values.phoneNumber.trim()) return t("auth.register.form.error.phone");
        if (!isValidRegisterPhone(values.phoneNumber)) {
          return t("auth.register.form.error.phoneInvalid");
        }
        return undefined;
      case "password":
        return passwordIssueMessage(getRegisterPasswordIssue(values.password));
      case "confirmPassword":
        if (!values.confirmPassword) return t("auth.register.form.error.confirmPassword");
        if (values.password !== values.confirmPassword) {
          return t("auth.register.form.error.passwordMismatch");
        }
        return undefined;
      default:
        return undefined;
    }
  };

  const validateAll = (): FieldErrors => {
    const errors: FieldErrors = {};
    (["fullName", "email", "phoneNumber", "password", "confirmPassword"] as FieldKey[]).forEach(
      (field) => {
        const message = validateField(field, fieldValues);
        if (message) errors[field] = message;
      },
    );
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
    const nextValues = { ...fieldValues, [field]: value };

    switch (field) {
      case "fullName":
        setFullName(value);
        break;
      case "email":
        setEmail(value);
        break;
      case "phoneNumber":
        setPhoneNumber(value);
        break;
      case "password":
        setPassword(value);
        if (nextValues.confirmPassword) {
          setFieldError("confirmPassword", validateField("confirmPassword", nextValues));
        }
        break;
      case "confirmPassword":
        setConfirmPassword(value);
        break;
    }

    const shouldValidate =
      value.length > 0 || fieldErrors[field] !== undefined || field === "confirmPassword";

    if (shouldValidate) {
      setFieldError(field, validateField(field, nextValues));
    }
  };

  const blurField = (field: FieldKey) => {
    setFieldError(field, validateField(field, fieldValues));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || success) return;

    const resolvedAccountType = accountType ?? readStoredAccountType();
    if (!resolvedAccountType) {
      onRequireAccountType?.();
      return;
    }

    const errors = validateAll();
    setFieldErrors(errors);
    setFormError(null);
    setShowConflictLogin(false);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await registerAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: normalizeRegisterPhone(phoneNumber),
        password,
        confirmPassword,
        accountType: resolvedAccountType,
      });

      clearStoredAccountType();
      setSuccess(true);
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
        } else if (conflictKind === "phone") {
          const message = t("auth.register.form.error.phoneDuplicate");
          setFieldError("phoneNumber", message);
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
          if (raw) localized[field] = localizeRegisterApiFieldMessage(field, raw);
        });
        setFieldErrors((prev) => ({ ...prev, ...localized }));
        setFormError(
          Object.values(localized)[0] ?? t("auth.register.form.error.generic"),
        );
        return;
      }

      const isNetworkFailure =
        !error.status ||
        error.message.toLowerCase().includes("network") ||
        error.message.toLowerCase().includes("timeout");

      setFormError(
        isNetworkFailure
          ? t("auth.register.form.error.network")
          : t("auth.register.form.error.generic"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div data-testid="register-form-card">
      <RegisterSuccessModal open={success} loginHref={loginHref} />

      {formError ? (
        <div
          className="mb-3 rounded-xl bg-[#fdecea] px-3 py-2 text-center text-sm text-[#b42318]"
          role="alert"
          data-testid="register-form-error"
        >
          <p>{formError}</p>
          {showConflictLogin ? (
            <p className="mt-1.5">
              <Link
                href={loginHref}
                onClick={markAuthNavigation}
                className="font-semibold underline underline-offset-2"
                data-testid="register-conflict-login"
              >
                {t("auth.register.form.error.conflictLogin")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3" noValidate>
        <input type="hidden" name="accountType" value={accountType ?? ""} readOnly />
        <RegisterField
          label={t("auth.register.form.fullName")}
          value={fullName}
          onChange={(value) => updateField("fullName", value)}
          onBlur={() => blurField("fullName")}
          placeholder={t("auth.register.form.fullNamePlaceholder")}
          error={fieldErrors.fullName}
          autoComplete="name"
          maxLength={REGISTER_LIMITS.maxFullNameLength}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <RegisterField
            label={t("auth.register.form.email")}
            type="email"
            value={email}
            onChange={(value) => updateField("email", value)}
            onBlur={() => blurField("email")}
            placeholder={t("auth.register.form.emailPlaceholder")}
            error={fieldErrors.email}
            autoComplete="email"
            maxLength={REGISTER_LIMITS.maxEmailLength}
          />
          <RegisterField
            label={t("auth.register.form.phone")}
            type="tel"
            value={phoneNumber}
            onChange={(value) => updateField("phoneNumber", value)}
            onBlur={() => blurField("phoneNumber")}
            placeholder={t("auth.register.form.phonePlaceholder")}
            error={fieldErrors.phoneNumber}
            autoComplete="tel"
            maxLength={REGISTER_LIMITS.maxPhoneLength}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <RegisterField
            label={t("auth.register.form.password")}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(value) => updateField("password", value)}
            onBlur={() => blurField("password")}
            placeholder={t("auth.register.form.passwordPlaceholder")}
            error={fieldErrors.password}
            autoComplete="new-password"
            maxLength={REGISTER_LIMITS.maxPasswordLength}
            trailing={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                label={
                  showPassword
                    ? t("auth.register.form.hidePassword")
                    : t("auth.register.form.showPassword")
                }
              />
            }
          />
          <RegisterField
            label={t("auth.register.form.confirmPassword")}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(value) => updateField("confirmPassword", value)}
            onBlur={() => blurField("confirmPassword")}
            placeholder={t("auth.register.form.confirmPasswordPlaceholder")}
            error={fieldErrors.confirmPassword}
            autoComplete="new-password"
            maxLength={REGISTER_LIMITS.maxPasswordLength}
            trailing={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
                label={
                  showConfirmPassword
                    ? t("auth.register.form.hidePassword")
                    : t("auth.register.form.showPassword")
                }
              />
            }
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={pending || undefined}
          className="btn-primary wesal-auth-submit mt-1 w-full !min-h-11 !rounded-xl !text-[0.95rem]"
          data-testid="register-submit"
        >
          {pending ? t("auth.register.form.submitting") : t("auth.register.form.submit")}
        </button>
      </form>

      <p className="mt-3.5 text-center text-xs text-[var(--wesal-muted)] sm:text-sm">
        {t("auth.register.haveAccount")}{" "}
        <Link
          href={loginHref}
          onClick={markAuthNavigation}
          className="font-semibold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
        >
          {t("auth.register.loginLink")}
        </Link>
      </p>
    </div>
  );
}

function RegisterField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  type = "text",
  autoComplete,
  trailing,
  maxLength,
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
  maxLength?: number;
}) {
  return (
    <label className="block text-xs sm:text-sm">
      <span
        className={`wesal-register-field-label mb-1 block ${error ? "wesal-register-field-label--error" : ""}`}
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
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={`wesal-register-field-input w-full rounded-lg border px-3 py-2.5 text-[0.9rem] outline-none transition focus:border-[var(--wesal-maroon)] ${
            trailing ? "pe-9" : ""
          } ${error ? "wesal-register-field-input--error" : "border-[var(--wesal-border)]"}`}
        />
        {trailing ? <div className="absolute end-1.5 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? (
        <span className="mt-0.5 block text-[0.7rem] font-medium text-[#b42318]" role="alert">
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
