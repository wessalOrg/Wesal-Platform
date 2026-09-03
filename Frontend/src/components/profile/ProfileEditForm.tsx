"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import ProfileField from "@/components/profile/ProfileField";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import type { ProfileFieldErrors, UserProfile } from "@/types/profile";

type Draft = {
  fullName: string;
  email: string;
  phoneNumber: string;
};

type ProfileEditModalProps = {
  open: boolean;
  profile: UserProfile;
  saving: boolean;
  fieldErrors: ProfileFieldErrors;
  formError: string | null;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<boolean>;
};

function toDraft(profile: UserProfile): Draft {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
  };
}

function resolveMessage(t: (key: string) => string, value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("errors.") || value.startsWith("profile.") ? t(value) : value;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "و";
}

export default function ProfileEditModal({
  open,
  profile,
  saving,
  fieldErrors,
  formError,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));

  useEffect(() => {
    if (open) setDraft(toDraft(profile));
  }, [open, profile.email, profile.fullName, profile.id, profile.phoneNumber]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, onClose, saving]);

  const dirty = useMemo(() => {
    return (
      draft.fullName.trim() !== profile.fullName ||
      draft.email.trim() !== profile.email ||
      draft.phoneNumber.trim() !== profile.phoneNumber
    );
  }, [draft, profile.email, profile.fullName, profile.phoneNumber]);

  if (!open) return null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !dirty) return;
    const saved = await onSave(draft);
    if (saved) onClose();
  };

  return (
    <div className="fixed inset-0 z-[120]" role="presentation" data-testid="profile-edit-modal">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        disabled={saving}
        onClick={onClose}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-4">
            <h2 id="profile-edit-title" className="text-lg font-bold text-[var(--wesal-maroon)]">
              {t("profile.editTitle")}
            </h2>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wesal-maroon)] hover:bg-white"
              aria-label={t("common.close")}
              disabled={saving}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={(event) => {
              void onSubmit(event);
            }}
            className="space-y-4 px-5 py-5"
            data-testid="profile-form"
            noValidate
          >
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[var(--wesal-maroon)]/35 bg-[var(--wesal-pink)] text-xl font-bold text-[var(--wesal-maroon)]">
                {initials(draft.fullName || profile.fullName)}
              </div>
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-[#f0d2ce] bg-[#fbf4f2] px-3 py-2.5 text-sm leading-6 text-[var(--wesal-maroon)]"
                data-testid="profile-form-error"
              >
                {resolveMessage(t, formError)}
              </p>
            ) : null}

            <ProfileField
              id="profile-full-name"
              label={t("profile.fullName")}
              value={draft.fullName}
              error={resolveMessage(t, fieldErrors.fullName)}
              disabled={saving}
              autoComplete="name"
              icon={<UserGlyph />}
              onChange={(fullName) => setDraft((current) => ({ ...current, fullName }))}
            />
            <ProfileField
              id="profile-phone"
              label={t("profile.phone")}
              type="tel"
              value={draft.phoneNumber}
              error={resolveMessage(t, fieldErrors.phoneNumber)}
              disabled={saving}
              autoComplete="tel"
              dir="ltr"
              icon={<PhoneGlyph />}
              onChange={(phoneNumber) => setDraft((current) => ({ ...current, phoneNumber }))}
            />
            <ProfileField
              id="profile-email"
              label={t("profile.email")}
              type="email"
              value={draft.email}
              error={resolveMessage(t, fieldErrors.email)}
              disabled={saving}
              autoComplete="email"
              dir="ltr"
              icon={<MailGlyph />}
              onChange={(email) => setDraft((current) => ({ ...current, email }))}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-start sm:gap-3">
              <button
                type="button"
                className="btn-outline min-h-11"
                disabled={saving}
                onClick={onClose}
              >
                {t("profile.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="btn-primary min-h-11"
                data-testid="profile-save"
              >
                {saving ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 18.2c1.4-2.6 3.7-4 6.5-4s5.1 1.4 6.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 4.8c.4-1 1.5-1.4 2.4-1L12 4.5c.7.3 1 .9.8 1.6L12.2 8c-.1.4 0 .8.3 1.1l2.4 2.4c.3.3.7.4 1.1.3l1.9-.6c.7-.2 1.3.1 1.6.8l.7 1.6c.4.9 0 2-1 2.4-2.2.9-7.3.3-11.1-3.5S4.9 7.2 5.8 5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 7.5 12 13l8-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
