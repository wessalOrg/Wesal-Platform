"use client";

import { useId, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { ApiError } from "@/lib/api-error";
import {
  PROFESSIONAL_BIO_MAX,
  validateProfessionalBio,
} from "@/lib/professional-bio";
import { useRequestScope } from "@/hooks/useRequestScope";
import { useT } from "@/i18n";
import { updateProfessionalBio } from "@/services/professional-profile";

type ProfessionalBioEditorProps = {
  initialBio: string | null;
  initialPhoneNumber: string | null;
  initialLocation: string | null;
  onClose: () => void;
  onSaved: (nextBio: string | null) => void;
};

export default function ProfessionalBioEditor({
  initialBio,
  initialPhoneNumber,
  initialLocation,
  onClose,
  onSaved,
}: ProfessionalBioEditorProps) {
  const t = useT();
  const scope = useRequestScope();
  const fieldId = useId();
  const [value, setValue] = useState(initialBio ?? "");
  const [phone, setPhone] = useState(initialPhoneNumber ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [issue, setIssue] = useState<"tooLong" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationText =
    issue === "tooLong" ? t("professionals.bio.errors.tooLong") : null;

  const onSave = async () => {
    const current = scope.capture();
    if (!current()) return;
    const nextIssue = validateProfessionalBio(value);
    setIssue(nextIssue);
    const phoneChanged = phone.trim() !== (initialPhoneNumber ?? "").trim();
    const invalidPhone = phoneChanged && !/^\+?[0-9][0-9\s\-]{6,19}$/.test(phone.trim());
    setPhoneInvalid(invalidPhone);
    if (nextIssue || invalidPhone) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfessionalBio(value, phoneChanged ? phone : undefined,
        location.trim() !== (initialLocation ?? "").trim() ? location : undefined);
      if (!current()) return;
      onSaved(value.trim() || null);
      onClose();
    } catch (err) {
      if (!current()) return;
      if (err instanceof ApiError && err.status === 403) {
        setError(t("professionals.bio.errors.forbidden"));
      } else {
        setError(t("professionals.bio.errors.saveFailed"));
      }
    } finally {
      if (current()) setSaving(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_14%,white)] bg-white p-4 shadow-[0_12px_30px_rgba(88,40,48,0.08)] sm:p-5"
      data-testid="professional-bio-editor"
      role="dialog"
      aria-labelledby={`${fieldId}-title`}
    >
      <h2
        id={`${fieldId}-title`}
        className="text-base font-bold text-[var(--wesal-text)]"
      >
        {t("professionals.bio.editTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
        {t("professionals.bio.editSubtitle")}
      </p>
      <label
        htmlFor={fieldId}
        className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
      >
        {t("professionals.bio.label")}
      </label>
      <textarea
        id={fieldId}
        value={value}
        disabled={saving}
        maxLength={PROFESSIONAL_BIO_MAX + 20}
        rows={5}
        placeholder={t("professionals.bio.placeholder")}
        aria-describedby={`${fieldId}-hint${validationText ? ` ${fieldId}-error` : ""}`}
        className={`${hallFieldClassName(Boolean(validationText))} mt-2 min-h-[7rem] w-full resize-y`}
        onChange={(event) => {
          setValue(event.target.value);
          setIssue(validateProfessionalBio(event.target.value));
        }}
      />
      <p id={`${fieldId}-hint`} className="mt-1 text-xs text-[var(--wesal-muted)]">
        {t("professionals.bio.hint", { max: String(PROFESSIONAL_BIO_MAX) })}
      </p>
      <div className="mt-4 grid grid-cols-2 items-start gap-3">
        <div className="min-w-0">
          <label htmlFor={`${fieldId}-phone`} className="block text-sm font-semibold text-[var(--wesal-text)]">
            {t("profile.phone")}
          </label>
          <input id={`${fieldId}-phone`} type="tel" autoComplete="tel" dir="ltr" value={phone}
            disabled={saving} maxLength={20} data-testid="professional-bio-phone"
            aria-invalid={phoneInvalid || undefined} aria-describedby={phoneInvalid ? `${fieldId}-phone-error` : undefined}
            className={`${hallFieldClassName(phoneInvalid)} mt-2 w-full min-w-0`}
            onChange={(event) => { setPhone(event.target.value); setPhoneInvalid(false); }} />
          {phoneInvalid ? <p id={`${fieldId}-phone-error`} className="mt-1 text-sm text-[#b42318]" role="alert">{t("errors.profile.phoneInvalid")}</p> : null}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${fieldId}-location`} className="block text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.bio.locationLabel")}
          </label>
          <input id={`${fieldId}-location`} type="text" value={location} maxLength={500}
            disabled={saving} data-testid="professional-bio-location" aria-describedby={`${fieldId}-location-hint`}
            className={`${hallFieldClassName(false)} mt-2 w-full min-w-0`}
            onChange={(event) => setLocation(event.target.value)} />
        </div>
      </div>
      <p id={`${fieldId}-location-hint`} className="mt-1 text-xs text-[var(--wesal-muted)]">{t("professionals.bio.locationHint")}</p>
      {validationText ? (
        <p id={`${fieldId}-error`} className="mt-1 text-sm text-[#b42318]" role="alert">
          {validationText}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-start gap-2 rtl:justify-end">
        <button
          type="button"
          className="btn-primary !min-h-11"
          disabled={saving}
          aria-busy={saving || undefined}
          data-testid="professional-bio-save"
          onClick={() => void onSave()}
        >
          {saving ? t("professionals.bio.saving") : t("professionals.bio.save")}
        </button>
        <button
          type="button"
          className="btn-outline !min-h-11"
          disabled={saving}
          onClick={onClose}
        >
          {t("professionals.bio.cancel")}
        </button>
      </div>
    </section>
  );
}
