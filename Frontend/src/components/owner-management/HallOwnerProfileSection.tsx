"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ManagementSectionError from "@/components/owner-management/ManagementSectionError";
import ProfileField from "@/components/profile/ProfileField";
import ProfileHeroCard from "@/components/profile/ProfileHeroCard";
import SuccessToast from "@/components/ui/SuccessToast";
import { useHallOwnerManagementProfile } from "@/hooks/useHallOwnerManagementProfile";
import { useT } from "@/i18n";
import {
  clearProfileAvatar,
  readImageFileAsDataUrl,
  readProfileAvatar,
  writeProfileAvatar,
} from "@/lib/profile-avatar";
import {
  changePassword,
  ChangePasswordError,
  type ChangePasswordFieldErrors,
  type ChangePasswordInput,
} from "@/services/change-password";

type ProfileDraft = {
  fullName: string;
  email: string;
  phoneNumber: string;
};

function toDraft(profile: {
  fullName: string;
  email: string;
  phoneNumber: string;
}): ProfileDraft {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "و";
}

function resolveMessage(
  t: (key: string) => string,
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return value.includes(".") ? t(value) : value;
}

const EMPTY_PASSWORD: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * Hall Owner account page — same composition as the seeker account page:
 * hero card, then profile/avatar edit + password change.
 */
export default function HallOwnerProfileSection() {
  const t = useT();
  const profileState = useHallOwnerManagementProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordInput>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordFieldErrors>({});
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (profileState.profile) {
      setDraft(toDraft(profileState.profile));
      setAvatarUrl(readProfileAvatar(profileState.profile.id));
    }
  }, [profileState.profile]);

  const dirty = useMemo(() => {
    if (!draft || !profileState.profile) return false;
    return (
      draft.fullName.trim() !== profileState.profile.fullName ||
      draft.email.trim() !== profileState.profile.email ||
      draft.phoneNumber.trim() !== profileState.profile.phoneNumber
    );
  }, [draft, profileState.profile]);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  if (!profileState.authReady || profileState.status === "idle" || profileState.status === "loading" || !draft) {
    return (
      <div
        className="h-72 animate-pulse rounded-3xl bg-white/80"
        aria-busy="true"
        data-testid="owner-profile-loading"
      />
    );
  }

  if (profileState.status === "error" || !profileState.profile) {
    return (
      <ManagementSectionError
        messageKey={profileState.loadError}
        onRetry={() => void profileState.reload()}
      />
    );
  }

  const profile = profileState.profile;

  const patchProfile = (patch: Partial<ProfileDraft>) => {
    setProfileSuccess(false);
    profileState.clearFormFeedback();
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || profileState.saving) return;
    const saved = await profileState.save(draft);
    if (saved) {
      setProfileSuccess(true);
      setToastMessage(t("common.changesSaved"));
    }
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSuccess(false);
    const result = await readImageFileAsDataUrl(file);
    setAvatarBusy(false);
    if (!result.ok) {
      setAvatarError(`seeker.settings.avatar.errors.${result.issue}`);
      return;
    }
    writeProfileAvatar(profile.id, result.dataUrl);
    setAvatarUrl(result.dataUrl);
    setAvatarSuccess(true);
    setToastMessage(t("common.changesSaved"));
  };

  const onRemoveAvatar = () => {
    clearProfileAvatar(profile.id);
    setAvatarUrl(null);
    setAvatarError(null);
    setAvatarSuccess(true);
    setToastMessage(t("common.changesSaved"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSavePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordSaving) return;
    setPasswordSaving(true);
    setPasswordErrors({});
    setPasswordFormError(null);
    setPasswordSuccess(false);
    try {
      await changePassword(passwordDraft);
      setPasswordDraft(EMPTY_PASSWORD);
      setPasswordSuccess(true);
      setToastMessage(t("common.changesSaved"));
    } catch (err) {
      if (err instanceof ChangePasswordError) {
        setPasswordErrors(err.fields);
        setPasswordFormError(err.message);
      } else {
        setPasswordFormError("seeker.settings.password.errors.generic");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="seeker-settings seeker-account-page" data-testid="owner-profile-section">
      <SuccessToast
        open={Boolean(toastMessage)}
        message={toastMessage ?? ""}
        onClose={dismissToast}
      />

      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("owner.nav.account")}</h1>
        <p className="seeker-settings-lead">{t("profile.subtitle")}</p>
      </header>

      <ProfileHeroCard profile={profile} />

      <div className="seeker-settings-split">
        <section className="seeker-settings-card" data-testid="owner-settings-profile">
          <h2 className="seeker-settings-section-title">{t("seeker.settings.profile.title")}</h2>
          <p className="seeker-settings-section-lead">{t("seeker.settings.profile.subtitle")}</p>

          <div className="seeker-settings-avatar-row" data-testid="owner-settings-avatar">
            <div className="seeker-settings-avatar" aria-hidden="true">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                <img src={avatarUrl} alt="" className="seeker-settings-avatar-img" />
              ) : (
                <span>{initials(draft.fullName || profile.fullName)}</span>
              )}
            </div>

            <div className="seeker-settings-avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                data-testid="owner-settings-avatar-input"
                onChange={(event) => {
                  void onPickAvatar(event.target.files?.[0] ?? null);
                }}
              />
              <button
                type="button"
                className="btn-primary min-h-11"
                disabled={avatarBusy}
                data-testid="owner-settings-avatar-pick"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarBusy ? t("seeker.settings.avatar.uploading") : t("seeker.settings.avatar.change")}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  className="btn-outline min-h-11"
                  disabled={avatarBusy}
                  data-testid="owner-settings-avatar-remove"
                  onClick={onRemoveAvatar}
                >
                  {t("seeker.settings.avatar.remove")}
                </button>
              ) : null}
            </div>
          </div>

          {avatarError ? (
            <p role="alert" className="seeker-settings-alert" data-testid="owner-settings-avatar-error">
              {resolveMessage(t, avatarError)}
            </p>
          ) : null}
          {avatarSuccess && !avatarError ? (
            <p role="status" className="seeker-settings-success" data-testid="owner-settings-avatar-success">
              {t("seeker.settings.avatar.saved")}
            </p>
          ) : null}

          <form
            className="seeker-settings-form"
            noValidate
            data-testid="owner-profile-form"
            onSubmit={(event) => {
              void onSaveProfile(event);
            }}
          >
            {profileSuccess ? (
              <p role="status" className="seeker-settings-success" data-testid="owner-profile-success">
                {t("profile.saved")}
              </p>
            ) : null}

            {profileState.formError ? (
              <p role="alert" className="seeker-settings-alert" data-testid="owner-profile-form-error">
                {resolveMessage(t, profileState.formError)}
              </p>
            ) : null}

            <div className="seeker-settings-grid">
              <ProfileField
                id="owner-settings-full-name"
                label={t("profile.fullName")}
                value={draft.fullName}
                error={resolveMessage(t, profileState.fieldErrors.fullName)}
                disabled={profileState.saving}
                autoComplete="name"
                onChange={(fullName) => patchProfile({ fullName })}
              />
              <ProfileField
                id="owner-settings-phone"
                label={t("profile.phone")}
                type="tel"
                value={draft.phoneNumber}
                error={resolveMessage(t, profileState.fieldErrors.phoneNumber)}
                disabled={profileState.saving}
                autoComplete="tel"
                dir="ltr"
                onChange={(phoneNumber) => patchProfile({ phoneNumber })}
              />
              <ProfileField
                id="owner-settings-email"
                label={t("profile.email")}
                type="email"
                value={draft.email}
                error={resolveMessage(t, profileState.fieldErrors.email)}
                disabled={profileState.saving}
                autoComplete="email"
                dir="ltr"
                onChange={(email) => patchProfile({ email })}
              />
            </div>

            <div className="seeker-settings-actions">
              <button
                type="submit"
                className="btn-primary min-h-11"
                disabled={profileState.saving || !dirty}
                aria-busy={profileState.saving || undefined}
                data-testid="owner-profile-save"
              >
                {profileState.saving ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          </form>
        </section>

        <section className="seeker-settings-card" data-testid="owner-settings-password">
          <h2 className="seeker-settings-section-title">{t("seeker.settings.password.title")}</h2>
          <p className="seeker-settings-section-lead">{t("seeker.settings.password.subtitle")}</p>

          <form
            className="seeker-settings-form"
            noValidate
            data-testid="owner-settings-password-form"
            onSubmit={(event) => {
              void onSavePassword(event);
            }}
          >
            {passwordSuccess ? (
              <p role="status" className="seeker-settings-success" data-testid="owner-settings-password-success">
                {t("seeker.settings.password.saved")}
              </p>
            ) : null}

            {passwordFormError && Object.keys(passwordErrors).length === 0 ? (
              <p role="alert" className="seeker-settings-alert" data-testid="owner-settings-password-error">
                {resolveMessage(t, passwordFormError)}
              </p>
            ) : null}

            <div className="seeker-settings-grid">
              <ProfileField
                id="owner-settings-current-password"
                label={t("seeker.settings.password.current")}
                type="password"
                value={passwordDraft.currentPassword}
                error={resolveMessage(t, passwordErrors.currentPassword)}
                disabled={passwordSaving}
                autoComplete="current-password"
                dir="ltr"
                onChange={(currentPassword) => {
                  setPasswordSuccess(false);
                  setPasswordFormError(null);
                  setPasswordErrors({});
                  setPasswordDraft((current) => ({ ...current, currentPassword }));
                }}
              />
              <ProfileField
                id="owner-settings-new-password"
                label={t("seeker.settings.password.new")}
                type="password"
                value={passwordDraft.newPassword}
                error={resolveMessage(t, passwordErrors.newPassword)}
                disabled={passwordSaving}
                autoComplete="new-password"
                dir="ltr"
                onChange={(newPassword) => {
                  setPasswordSuccess(false);
                  setPasswordFormError(null);
                  setPasswordErrors({});
                  setPasswordDraft((current) => ({ ...current, newPassword }));
                }}
              />
              <ProfileField
                id="owner-settings-confirm-password"
                label={t("seeker.settings.password.confirm")}
                type="password"
                value={passwordDraft.confirmPassword}
                error={resolveMessage(t, passwordErrors.confirmPassword)}
                disabled={passwordSaving}
                autoComplete="new-password"
                dir="ltr"
                onChange={(confirmPassword) => {
                  setPasswordSuccess(false);
                  setPasswordFormError(null);
                  setPasswordErrors({});
                  setPasswordDraft((current) => ({ ...current, confirmPassword }));
                }}
              />
            </div>

            <div className="seeker-settings-actions">
              <button
                type="submit"
                className="btn-primary min-h-11"
                disabled={
                  passwordSaving ||
                  !passwordDraft.currentPassword ||
                  !passwordDraft.newPassword ||
                  !passwordDraft.confirmPassword
                }
                data-testid="owner-settings-password-save"
              >
                {passwordSaving
                  ? t("seeker.settings.password.saving")
                  : t("seeker.settings.password.save")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
