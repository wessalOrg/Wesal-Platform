"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import CoordinatorImageUploadField from "@/components/auth/coordinator-setup/CoordinatorImageUploadField";
import PhotographerStudioTypeSelector from "@/components/auth/photographer-setup/PhotographerStudioTypeSelector";
import { useT } from "@/i18n";
import { ApiError, getApiFieldMessages } from "@/lib/api-error";
import { mapPhotographerSetupToFormData } from "@/lib/photographer-setup-mapper";
import {
  createEmptyPhotographerSetupValues,
  switchPhotographerStudioBranch,
  validatePhotographerSetupValues,
} from "@/lib/photographer-setup-validation";
import {
  resubmitPhotographerSetup,
  submitPhotographerSetup,
} from "@/services/photographer-setup";
import {
  PHOTOGRAPHER_IDENTITY_ACCEPT,
  PHOTOGRAPHER_LIMITS,
  type PhotographerSetupFieldErrors,
  type PhotographerSetupValues,
} from "@/types/photographer-setup";

export type PhotographerSetupFormMode = "create" | "resubmit";

type PhotographerSetupFormProps = {
  mode?: PhotographerSetupFormMode;
  onSuccess: () => void;
  onBack?: () => void;
};

function localizeError(
  t: (key: string) => string,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  const translated = t(key);
  return translated === key ? key : translated;
}

function mapBackendFieldErrors(
  error: ApiError,
  t: (key: string) => string,
): PhotographerSetupFieldErrors {
  const next: PhotographerSetupFieldErrors = {};
  const pairs: Array<[string, keyof PhotographerSetupFieldErrors]> = [
    ["HasStudio", "hasStudio"],
    ["StudioName", "studioName"],
    ["StudioLocation", "studioLocation"],
    ["DetailedStudioLocation", "detailedStudioLocation"],
    ["FullName", "fullName"],
    ["PhoneNumber", "phoneNumber"],
    ["IdentityDocument", "identityDocument"],
  ];
  for (const [apiField, localField] of pairs) {
    const messages = getApiFieldMessages(error, apiField);
    if (messages[0]) next[localField] = messages[0];
  }
  if (Object.keys(next).length === 0) {
    next.form = t("auth.photographer.setup.error.generic");
  }
  return next;
}

export default function PhotographerSetupForm({
  mode = "create",
  onSuccess,
  onBack,
}: PhotographerSetupFormProps) {
  const t = useT();
  const isResubmit = mode === "resubmit";
  const [values, setValues] = useState<PhotographerSetupValues>(() =>
    createEmptyPhotographerSetupValues(true),
  );
  const [hasSelectedType, setHasSelectedType] = useState(false);
  const [errors, setErrors] = useState<PhotographerSetupFieldErrors>({});
  const [pending, setPending] = useState(false);

  const setHasStudio = (hasStudio: boolean) => {
    setHasSelectedType(true);
    setValues((prev) => switchPhotographerStudioBranch(prev, hasStudio));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.hasStudio;
      delete next.studioName;
      delete next.studioLocation;
      delete next.detailedStudioLocation;
      delete next.fullName;
      return next;
    });
  };

  const clearFieldError = (field: keyof PhotographerSetupFieldErrors) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    if (!hasSelectedType) {
      setErrors({ hasStudio: t("auth.photographer.setup.error.hasStudio") });
      return;
    }

    const validation = validatePhotographerSetupValues(values);
    if (Object.keys(validation).length > 0) {
      const localized: PhotographerSetupFieldErrors = {};
      for (const [key, messageKey] of Object.entries(validation)) {
        localized[key as keyof PhotographerSetupFieldErrors] =
          localizeError(t, messageKey) ?? messageKey;
      }
      setErrors(localized);
      return;
    }

    setPending(true);
    setErrors({});
    try {
      const formData = mapPhotographerSetupToFormData(values);
      if (isResubmit) {
        await resubmitPhotographerSetup(formData);
      } else {
        await submitPhotographerSetup(formData);
      }
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && !isResubmit) {
          onSuccess();
          return;
        }
        setErrors(mapBackendFieldErrors(error, t));
      } else {
        setErrors({ form: t("auth.photographer.setup.error.generic") });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mt-3.5 space-y-3"
      noValidate
      data-testid="photographer-setup-form"
      data-mode={mode}
    >
      {isResubmit ? (
        <p
          className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,#ead9d4)] bg-[#faf4f2] px-3.5 py-3 text-start text-[0.8rem] leading-6 text-[var(--wesal-muted)]"
          data-testid="photographer-resubmit-notice"
        >
          {t("auth.photographer.setup.resubmitNotice")}
        </p>
      ) : null}
      <PhotographerStudioTypeSelector
        value={hasSelectedType ? values.hasStudio : null}
        error={errors.hasStudio}
        onChange={setHasStudio}
      />

      {hasSelectedType ? (
        values.hasStudio ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field
                id="photographer-studio-name"
                label={t("auth.photographer.setup.studioName")}
                required
                error={errors.studioName}
              >
                <IconInput
                  id="photographer-studio-name"
                  value={values.studioName}
                  maxLength={PHOTOGRAPHER_LIMITS.maxStudioNameLength}
                  placeholder={t("auth.photographer.setup.studioNamePlaceholder")}
                  hasError={Boolean(errors.studioName)}
                  testId="photographer-studio-name"
                  icon={<StoreIcon />}
                  onChange={(value) => {
                    setValues({ ...values, studioName: value });
                    clearFieldError("studioName");
                  }}
                />
              </Field>

              <Field
                id="photographer-studio-phone"
                label={t("auth.photographer.setup.studioPhone")}
                required
                error={errors.phoneNumber}
              >
                <PhoneInput
                  id="photographer-studio-phone"
                  value={values.phoneNumber}
                  hasError={Boolean(errors.phoneNumber)}
                  placeholder={t("auth.photographer.setup.phonePlaceholder")}
                  testId="photographer-phone"
                  onChange={(value) => {
                    setValues({ ...values, phoneNumber: value });
                    clearFieldError("phoneNumber");
                  }}
                />
              </Field>
            </div>

            <Field
              id="photographer-studio-location"
              label={t("auth.photographer.setup.studioLocation")}
              required
              error={errors.studioLocation}
            >
              <IconInput
                id="photographer-studio-location"
                value={values.studioLocation}
                maxLength={PHOTOGRAPHER_LIMITS.maxStudioLocationLength}
                placeholder={t("auth.photographer.setup.studioLocationPlaceholder")}
                hasError={Boolean(errors.studioLocation)}
                testId="photographer-studio-location"
                icon={<PinIcon />}
                onChange={(value) => {
                  setValues({ ...values, studioLocation: value });
                  clearFieldError("studioLocation");
                }}
              />
            </Field>

            <Field
              id="photographer-detailed-location"
              label={t("auth.photographer.setup.detailedStudioLocation")}
              required
              error={errors.detailedStudioLocation}
            >
              <IconInput
                id="photographer-detailed-location"
                value={values.detailedStudioLocation}
                maxLength={PHOTOGRAPHER_LIMITS.maxDetailedStudioLocationLength}
                placeholder={t(
                  "auth.photographer.setup.detailedStudioLocationPlaceholder",
                )}
                hasError={Boolean(errors.detailedStudioLocation)}
                testId="photographer-detailed-location"
                icon={<PinIcon />}
                onChange={(value) => {
                  setValues({ ...values, detailedStudioLocation: value });
                  clearFieldError("detailedStudioLocation");
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <CoordinatorImageUploadField
                label={t("auth.photographer.setup.identityDocument")}
                hint={t("auth.photographer.setup.identityHint")}
                required
                accept={PHOTOGRAPHER_IDENTITY_ACCEPT}
                file={values.identityDocument}
                error={errors.identityDocument}
                testId="photographer-identity"
                onChange={(file) => {
                  setValues({ ...values, identityDocument: file });
                  clearFieldError("identityDocument");
                }}
              />
            </div>
          </>
        ) : (
          <>
            <Field
              id="photographer-full-name"
              label={t("auth.photographer.setup.fullName")}
              required
              error={errors.fullName}
              hint={t("auth.photographer.setup.fullNamePrivacyNote")}
            >
              <IconInput
                id="photographer-full-name"
                value={values.fullName}
                maxLength={PHOTOGRAPHER_LIMITS.maxFullNameLength}
                placeholder={t("auth.photographer.setup.fullNamePlaceholder")}
                hasError={Boolean(errors.fullName)}
                testId="photographer-full-name"
                icon={<UserIcon />}
                onChange={(value) => {
                  setValues({ ...values, fullName: value });
                  clearFieldError("fullName");
                }}
              />
            </Field>

            <Field
              id="photographer-phone"
              label={t("auth.photographer.setup.phone")}
              required
              error={errors.phoneNumber}
            >
              <PhoneInput
                id="photographer-phone"
                value={values.phoneNumber}
                hasError={Boolean(errors.phoneNumber)}
                placeholder={t("auth.photographer.setup.phonePlaceholder")}
                testId="photographer-phone"
                onChange={(value) => {
                  setValues({ ...values, phoneNumber: value });
                  clearFieldError("phoneNumber");
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <CoordinatorImageUploadField
                label={t("auth.photographer.setup.identityDocument")}
                hint={t("auth.photographer.setup.identityHint")}
                required
                compact
                accept={PHOTOGRAPHER_IDENTITY_ACCEPT}
                file={values.identityDocument}
                error={errors.identityDocument}
                testId="photographer-identity"
                onChange={(file) => {
                  setValues({ ...values, identityDocument: file });
                  clearFieldError("identityDocument");
                }}
              />
            </div>
          </>
        )
      ) : null}

      {errors.form ? (
        <p className="text-center text-sm font-medium text-[#b42318]" role="alert">
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="wesal-role-setup-btn wesal-text-bold flex-[1.55]"
          data-testid="photographer-setup-submit"
        >
          <span>
            {pending
              ? t(
                  isResubmit
                    ? "auth.photographer.setup.resubmitting"
                    : "auth.photographer.setup.submitting",
                )
              : t(
                  isResubmit
                    ? "auth.photographer.setup.resubmit"
                    : "auth.photographer.setup.continue",
                )}
          </span>
          {!pending ? <span aria-hidden="true">←</span> : null}
        </button>
        {onBack ? (
          <button
            type="button"
            className="wesal-role-setup-btn-outline flex-1"
            onClick={onBack}
            disabled={pending}
            data-testid="photographer-setup-back"
          >
            <span aria-hidden="true">→</span>
            {t(
              isResubmit
                ? "auth.photographer.setup.resubmitCancel"
                : "auth.photographer.setup.previous",
            )}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[0.82rem] font-semibold text-[var(--wesal-text)]">
        {label}
        {required ? (
          <span className="ms-1 text-[#c45b55]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mb-1.5 text-[0.7rem] leading-5 text-[var(--wesal-muted)]">{hint}</p>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-[0.7rem] font-medium text-[#b42318]" role="alert">
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
  maxLength,
  hasError,
  icon,
  testId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  hasError: boolean;
  icon: ReactNode;
  testId: string;
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
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "wesal-role-setup-input wesal-role-setup-input--icon-start",
          hasError ? "wesal-role-setup-input--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={testId}
      />
    </div>
  );
}

function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
  hasError,
  testId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasError: boolean;
  testId: string;
}) {
  return (
    <div
      dir="ltr"
      className={`flex min-h-[2.45rem] overflow-hidden rounded-[0.75rem] border bg-white ${
        hasError ? "border-[#c45b55]" : "border-[var(--wesal-border)]"
      }`}
    >
      <span
        className="inline-flex shrink-0 items-center gap-1 border-e border-[var(--wesal-border)] bg-[color-mix(in_srgb,var(--wesal-pink)_40%,white)] px-2 text-[0.72rem] font-semibold text-[var(--wesal-text)]"
        aria-hidden="true"
      >
        +970
        <PalestineFlag />
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        maxLength={PHOTOGRAPHER_LIMITS.maxPhoneNumberLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-[0.82rem] outline-none placeholder:text-[var(--wesal-muted)]"
        data-testid={testId}
      />
    </div>
  );
}

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <path
        d="M4.5 10.2 6 6.5h12l1.5 3.7v1.3c0 1-.8 1.8-1.8 1.8S16 12.5 16 11.5c0 1-.8 1.8-1.8 1.8s-1.7-.8-1.7-1.8c0 1-.8 1.8-1.8 1.8S9 12.5 9 11.5c0 1-.8 1.8-1.8 1.8S5.5 12.5 5.5 11.5v-1.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M6.2 13.2V19h11.6v-5.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.8 18.5c1.3-2.8 3.4-4.2 6.2-4.2s4.9 1.4 6.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PalestineFlag() {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-4.5 overflow-hidden rounded-[2px]" aria-hidden="true">
      <rect width="18" height="4" y="0" fill="#000" />
      <rect width="18" height="4" y="4" fill="#fff" />
      <rect width="18" height="4" y="8" fill="#007a3d" />
      <path d="M0 0 8 6 0 12Z" fill="#ce1126" />
    </svg>
  );
}
