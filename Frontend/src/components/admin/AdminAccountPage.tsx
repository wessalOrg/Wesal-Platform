"use client";

import { useEffect, useState } from "react";
import ProfileAvatarField from "@/components/profile/ProfileAvatarField";
import SuccessToast from "@/components/ui/SuccessToast";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useT } from "@/i18n";
import {
  readProfileAvatar,
  resolveProfileAvatarUserIds,
  syncProfileAvatar,
} from "@/lib/profile-avatar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "و";
}

function readCommittedAvatar(userId: string | null | undefined): string | null {
  for (const id of resolveProfileAvatarUserIds(userId)) {
    const value = readProfileAvatar(id);
    if (value) return value;
  }
  return null;
}

/** Admin account photo settings (local avatar with crop/zoom). */
export default function AdminAccountPage() {
  const t = useT();
  const identity = useUserIdentity();
  const account = useAccountAccess();
  const userId = account.userId;
  const displayName = identity.displayName || t("admin.guestName");

  const [committedAvatar, setCommittedAvatar] = useState<string | null>(() =>
    readCommittedAvatar(userId),
  );
  const [avatarDraft, setAvatarDraft] = useState<string | null>(() =>
    readCommittedAvatar(userId),
  );
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = readCommittedAvatar(userId);
    setCommittedAvatar(next);
    setAvatarDraft(next);
  }, [userId]);

  const avatarDirty = avatarDraft !== committedAvatar;

  const onSave = () => {
    if (!avatarDirty) return;
    syncProfileAvatar(userId, avatarDraft);
    setCommittedAvatar(avatarDraft);
    setToastMessage(t("common.changesSaved"));
  };

  return (
    <div className="seeker-settings seeker-account-page" data-testid="admin-account-page">
      <SuccessToast
        open={Boolean(toastMessage)}
        message={toastMessage ?? ""}
        onClose={() => setToastMessage(null)}
      />

      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("admin.account.title")}</h1>
      </header>

      <section className="seeker-settings-card" data-testid="admin-account-avatar-card">
        <h2 className="seeker-settings-section-title">{t("seeker.settings.avatar.title")}</h2>

        <ProfileAvatarField
          draftUrl={avatarDraft}
          initialsLabel={initials(displayName)}
          busy={avatarBusy}
          testIdPrefix="admin-settings"
          errorKey={avatarError}
          showPendingHint={avatarDirty}
          onBusyChange={setAvatarBusy}
          onError={setAvatarError}
          onDraftChange={(dataUrl) => {
            setAvatarDraft(dataUrl);
            setAvatarError(null);
          }}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={!avatarDirty || avatarBusy}
            data-testid="admin-settings-avatar-save"
            onClick={onSave}
          >
            {t("profile.save")}
          </button>
        </div>
      </section>
    </div>
  );
}
