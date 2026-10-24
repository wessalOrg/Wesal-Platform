"use client";

import { useRef, useState } from "react";
import ProfileAvatarCropDialog from "@/components/profile/ProfileAvatarCropDialog";
import { readImageFileForCrop } from "@/lib/profile-avatar";
import { useT, type TranslateFn } from "@/i18n";

function resolveMessage(t: TranslateFn, key: string | null | undefined): string {
  if (!key) return "";
  const value = t(key);
  return value === key ? key : value;
}

type ProfileAvatarFieldProps = {
  draftUrl: string | null;
  initialsLabel: string;
  busy?: boolean;
  testIdPrefix: string;
  onDraftChange: (dataUrl: string | null) => void;
  onError: (messageKey: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  errorKey?: string | null;
  showPendingHint?: boolean;
};

export default function ProfileAvatarField({
  draftUrl,
  initialsLabel,
  busy = false,
  testIdPrefix,
  onDraftChange,
  onError,
  onBusyChange,
  errorKey = null,
  showPendingHint = false,
}: ProfileAvatarFieldProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const setBusy = (value: boolean) => onBusyChange?.(value);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    onError(null);
    const result = await readImageFileForCrop(file);
    setBusy(false);
    if (!result.ok) {
      onError(`seeker.settings.avatar.errors.${result.issue}`);
      return;
    }
    setCropSrc(result.dataUrl);
  };

  const onRemove = () => {
    onDraftChange(null);
    onError(null);
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <div className="seeker-settings-avatar-row" data-testid={`${testIdPrefix}-avatar`}>
        <div className="seeker-settings-avatar" aria-hidden="true">
          {draftUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={draftUrl} alt="" className="seeker-settings-avatar-img" />
          ) : (
            <span>{initialsLabel}</span>
          )}
        </div>

        <div className="seeker-settings-avatar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            data-testid={`${testIdPrefix}-avatar-input`}
            onChange={(event) => {
              void onPickFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={busy}
            data-testid={`${testIdPrefix}-avatar-pick`}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? t("seeker.settings.avatar.uploading") : t("seeker.settings.avatar.change")}
          </button>
          {draftUrl ? (
            <button
              type="button"
              className="btn-outline min-h-11"
              disabled={busy}
              data-testid={`${testIdPrefix}-avatar-remove`}
              onClick={onRemove}
            >
              {t("seeker.settings.avatar.remove")}
            </button>
          ) : null}
        </div>
      </div>

      {errorKey ? (
        <p role="alert" className="seeker-settings-alert" data-testid={`${testIdPrefix}-avatar-error`}>
          {resolveMessage(t, errorKey)}
        </p>
      ) : null}
      {showPendingHint && !errorKey ? (
        <p
          role="status"
          className="seeker-settings-section-lead"
          data-testid={`${testIdPrefix}-avatar-pending`}
        >
          {t("seeker.settings.avatar.pendingSave")}
        </p>
      ) : null}

      <ProfileAvatarCropDialog
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        busy={busy}
        onCancel={() => setCropSrc(null)}
        onConfirm={(dataUrl) => {
          onDraftChange(dataUrl);
          setCropSrc(null);
        }}
      />
    </>
  );
}
