"use client";

import { useId, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { ApiError } from "@/lib/api-error";
import {
  PROFESSIONAL_BIO_MAX,
  validateProfessionalBio,
} from "@/lib/professional-bio";
import { useT } from "@/i18n";
import { updateProfessionalBio } from "@/services/professional-profile";

type ProfessionalBioEditorProps = {
  initialBio: string | null;
  onClose: () => void;
  onSaved: (nextBio: string | null) => void;
};

export default function ProfessionalBioEditor({
  initialBio,
  onClose,
  onSaved,
}: ProfessionalBioEditorProps) {
  const t = useT();
  const fieldId = useId();
  const [value, setValue] = useState(initialBio ?? "");
  const [issue, setIssue] = useState<"tooLong" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationText =
    issue === "tooLong" ? t("professionals.bio.errors.tooLong") : null;

  const onSave = async () => {
    const nextIssue = validateProfessionalBio(value);
    setIssue(nextIssue);
    if (nextIssue) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfessionalBio(value);
      onSaved(value.trim() || null);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("professionals.bio.errors.forbidden"));
      } else {
        setError(t("professionals.bio.errors.saveFailed"));
      }
    } finally {
      setSaving(false);
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
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
