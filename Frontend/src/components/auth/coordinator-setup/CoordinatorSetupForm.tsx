"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import CoordinatorBusinessTypeSelector from "@/components/auth/coordinator-setup/CoordinatorBusinessTypeSelector";
import CoordinatorImageUploadField from "@/components/auth/coordinator-setup/CoordinatorImageUploadField";
import { useT } from "@/i18n";
import { ApiError, getApiFieldMessages } from "@/lib/api-error";
import { mapCoordinatorSetupToFormData } from "@/lib/coordinator-setup-mapper";
import {
  createEmptyCoordinatorSetupValues,
  switchCoordinatorBusinessType,
  validateCoordinatorSetupValues,
} from "@/lib/coordinator-setup-validation";
import {
  resubmitCoordinatorSetup,
  submitCoordinatorSetup,
} from "@/services/coordinator-setup";
import {
  COORDINATOR_IDENTITY_ACCEPT,
  COORDINATOR_IMAGE_ACCEPT,
  COORDINATOR_LIMITS,
  type CoordinatorBusinessType,
  type CoordinatorSetupFieldErrors,
  type CoordinatorSetupValues,
} from "@/types/coordinator-setup";

export type CoordinatorSetupFormMode = "create" | "resubmit";

type CoordinatorSetupFormProps = {
  mode?: CoordinatorSetupFormMode;
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
): CoordinatorSetupFieldErrors {
  const next: CoordinatorSetupFieldErrors = {};
  const pairs: Array<[string, keyof CoordinatorSetupFieldErrors]> = [
    ["BusinessType", "businessType"],
    ["ShopName", "shopName"],
    ["ShopLocation", "shopLocation"],
    ["OnlineStoreName", "onlineStoreName"],
    ["PhoneNumber", "phoneNumber"],
    ["ShopPhoto", "shopPhoto"],
    ["WorkPhotos", "workPhotos"],
    ["IdentityDocument", "identityDocument"],
  ];
  for (const [apiField, localField] of pairs) {
    const messages = getApiFieldMessages(error, apiField);
    if (messages[0]) next[localField] = messages[0];
  }
  if (Object.keys(next).length === 0) {
    next.form = t("auth.coordinator.setup.error.generic");
  }
  return next;
}

export default function CoordinatorSetupForm({
  mode = "create",
  onSuccess,
  onBack,
}: CoordinatorSetupFormProps) {
  const t = useT();
  const isResubmit = mode === "resubmit";
  const [values, setValues] = useState<CoordinatorSetupValues>(() =>
    createEmptyCoordinatorSetupValues("Shop"),
  );
  const [hasSelectedType, setHasSelectedType] = useState(true);
  const [errors, setErrors] = useState<CoordinatorSetupFieldErrors>({});
  const [pending, setPending] = useState(false);

  const setBusinessType = (businessType: CoordinatorBusinessType) => {
    setHasSelectedType(true);
    setValues((prev) => switchCoordinatorBusinessType(prev, businessType));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.businessType;
      delete next.shopName;
      delete next.shopLocation;
      delete next.shopPhoto;
      delete next.onlineStoreName;
      delete next.workPhotos;
      delete next.workPhoto0;
      delete next.workPhoto1;
      return next;
    });
  };

  const clearFieldError = (field: keyof CoordinatorSetupFieldErrors) => {
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
      setErrors({ businessType: t("auth.coordinator.setup.error.businessType") });
      return;
    }

    const validation = validateCoordinatorSetupValues(values);
    if (Object.keys(validation).length > 0) {
      const localized: CoordinatorSetupFieldErrors = {};
      for (const [key, messageKey] of Object.entries(validation)) {
        localized[key as keyof CoordinatorSetupFieldErrors] =
          localizeError(t, messageKey) ?? messageKey;
      }
      setErrors(localized);
      return;
    }

    setPending(true);
    setErrors({});
    try {
      const formData = mapCoordinatorSetupToFormData(values);
      if (isResubmit) {
        await resubmitCoordinatorSetup(formData);
      } else {
        await submitCoordinatorSetup(formData);
      }
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        // Initial setup: 409 means already submitted — treat as success.
        // Resubmit: 409 means wrong approval state — surface the error.
        if (error.status === 409 && !isResubmit) {
          onSuccess();
          return;
        }
        setErrors(mapBackendFieldErrors(error, t));
      } else {
        setErrors({ form: t("auth.coordinator.setup.error.generic") });
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
      data-testid="coordinator-setup-form"
      data-mode={mode}
    >
      {isResubmit ? (
        <p
          className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,#ead9d4)] bg-[#faf4f2] px-3.5 py-3 text-start text-[0.8rem] leading-6 text-[var(--wesal-muted)]"
          data-testid="coordinator-resubmit-notice"
        >
          {t("auth.coordinator.setup.resubmitNotice")}
        </p>
      ) : null}
      <CoordinatorBusinessTypeSelector
        value={hasSelectedType ? values.businessType : null}
        error={errors.businessType}
        onChange={setBusinessType}
      />

      {hasSelectedType ? (
        values.businessType === "Shop" ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field
                id="coordinator-shop-name"
                label={t("auth.coordinator.setup.shopName")}
                required
                error={errors.shopName}
              >
                <IconInput
                  id="coordinator-shop-name"
                  value={values.shopName}
                  maxLength={COORDINATOR_LIMITS.maxShopNameLength}
                  placeholder={t("auth.coordinator.setup.shopNamePlaceholder")}
                  hasError={Boolean(errors.shopName)}
                  testId="coordinator-shop-name"
                  icon={<StoreIcon />}
                  onChange={(value) => {
                    setValues({ ...values, shopName: value });
                    clearFieldError("shopName");
                  }}
                />
              </Field>

              <Field
                id="coordinator-phone"
                label={t("auth.coordinator.setup.phone")}
                required
                error={errors.phoneNumber}
              >
                <PhoneInput
                  id="coordinator-phone"
                  value={values.phoneNumber}
                  hasError={Boolean(errors.phoneNumber)}
                  placeholder={t("auth.coordinator.setup.phonePlaceholder")}
                  onChange={(value) => {
                    setValues({ ...values, phoneNumber: value });
                    clearFieldError("phoneNumber");
                  }}
                />
              </Field>
            </div>

            <Field
              id="coordinator-shop-location"
              label={t("auth.coordinator.setup.shopLocation")}
              required
              error={errors.shopLocation}
            >
              <IconInput
                id="coordinator-shop-location"
                value={values.shopLocation}
                maxLength={COORDINATOR_LIMITS.maxShopLocationLength}
                placeholder={t("auth.coordinator.setup.shopLocationPlaceholder")}
                hasError={Boolean(errors.shopLocation)}
                testId="coordinator-shop-location"
                icon={<PinIcon />}
                onChange={(value) => {
                  setValues({ ...values, shopLocation: value });
                  clearFieldError("shopLocation");
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <CoordinatorImageUploadField
                label={t("auth.coordinator.setup.shopPhoto")}
                hint={t("auth.coordinator.setup.shopPhotoHint")}
                required
                accept={COORDINATOR_IMAGE_ACCEPT}
                file={values.shopPhoto}
                error={errors.shopPhoto}
                testId="coordinator-shop-photo"
                onChange={(file) => {
                  setValues({ ...values, shopPhoto: file });
                  clearFieldError("shopPhoto");
                }}
              />
              <CoordinatorImageUploadField
                label={t("auth.coordinator.setup.identityDocument")}
                hint={t("auth.coordinator.setup.identityHint")}
                required
                accept={COORDINATOR_IDENTITY_ACCEPT}
                file={values.identityDocument}
                error={errors.identityDocument}
                testId="coordinator-identity"
                onChange={(file) => {
                  setValues({ ...values, identityDocument: file });
                  clearFieldError("identityDocument");
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field
                id="coordinator-store-name"
                label={t("auth.coordinator.setup.onlineStoreName")}
                required
                error={errors.onlineStoreName}
              >
                <IconInput
                  id="coordinator-store-name"
                  value={values.onlineStoreName}
                  maxLength={COORDINATOR_LIMITS.maxOnlineStoreNameLength}
                  placeholder={t("auth.coordinator.setup.onlineStoreNamePlaceholder")}
                  hasError={Boolean(errors.onlineStoreName)}
                  testId="coordinator-online-store-name"
                  icon={<StoreIcon />}
                  onChange={(value) => {
                    setValues({ ...values, onlineStoreName: value });
                    clearFieldError("onlineStoreName");
                  }}
                />
              </Field>

              <Field
                id="coordinator-phone"
                label={t("auth.coordinator.setup.phone")}
                required
                error={errors.phoneNumber}
              >
                <PhoneInput
                  id="coordinator-phone"
                  value={values.phoneNumber}
                  hasError={Boolean(errors.phoneNumber)}
                  placeholder={t("auth.coordinator.setup.phonePlaceholder")}
                  onChange={(value) => {
                    setValues({ ...values, phoneNumber: value });
                    clearFieldError("phoneNumber");
                  }}
                />
              </Field>
            </div>

            <div>
              <p className="mb-1 text-[0.82rem] font-semibold text-[var(--wesal-text)]">
                {t("auth.coordinator.setup.workPhotos")}
                <span className="ms-1 text-[#c45b55]" aria-hidden="true">
                  *
                </span>
              </p>
              <p className="mb-1.5 text-[0.7rem] text-[var(--wesal-muted)]">
                {t("auth.coordinator.setup.workPhotosHint")}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {([0, 1] as const).map((index) => (
                  <CoordinatorImageUploadField
                    key={index}
                    label={t("auth.coordinator.setup.workPhotoSlot", { n: index + 1 })}
                    hint={t("auth.coordinator.setup.workPhotoHint")}
                    required
                    accept={COORDINATOR_IMAGE_ACCEPT}
                    file={values.workPhotos[index]}
                    error={
                      errors[index === 0 ? "workPhoto0" : "workPhoto1"] ??
                      (index === 0 ? errors.workPhotos : undefined)
                    }
                    testId={`coordinator-work-photo-${index}`}
                    onChange={(file) => {
                      const workPhotos: [File | null, File | null] = [
                        values.workPhotos[0],
                        values.workPhotos[1],
                      ];
                      workPhotos[index] = file;
                      setValues({ ...values, workPhotos });
                      clearFieldError(index === 0 ? "workPhoto0" : "workPhoto1");
                      clearFieldError("workPhotos");
                    }}
                  />
                ))}
              </div>
            </div>

            <CoordinatorImageUploadField
              label={t("auth.coordinator.setup.identityDocument")}
              hint={t("auth.coordinator.setup.identityHint")}
              required
              compact
              accept={COORDINATOR_IDENTITY_ACCEPT}
              file={values.identityDocument}
              error={errors.identityDocument}
              testId="coordinator-identity"
              onChange={(file) => {
                setValues({ ...values, identityDocument: file });
                clearFieldError("identityDocument");
              }}
            />
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
          data-testid="coordinator-setup-submit"
        >
          <span>
            {pending
              ? t(
                  isResubmit
                    ? "auth.coordinator.setup.resubmitting"
                    : "auth.coordinator.setup.submitting",
                )
              : t(
                  isResubmit
                    ? "auth.coordinator.setup.resubmit"
                    : "auth.coordinator.setup.continue",
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
            data-testid="coordinator-setup-back"
          >
            <span aria-hidden="true">→</span>
            {t(
              isResubmit
                ? "auth.coordinator.setup.resubmitCancel"
                : "auth.coordinator.setup.previous",
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
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
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
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasError: boolean;
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
        maxLength={COORDINATOR_LIMITS.maxPhoneNumberLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-[0.82rem] outline-none placeholder:text-[var(--wesal-muted)]"
        data-testid="coordinator-phone"
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
