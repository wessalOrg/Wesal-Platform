"use client";

import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useT } from "@/i18n";

export default function AudioPermissionBanner() {
  const t = useT();
  const audio = useAudioPermission();
  const needsEnable =
    !audio.muted && (audio.status === "pending" || audio.status === "blocked" || audio.status === "failed");

  if (!needsEnable) return null;

  const message =
    audio.status === "failed"
      ? t("owner.audio.failed")
      : t("owner.audio.blockedHint");

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-[var(--wesal-border)] bg-white px-4 py-2.5 sm:px-5"
      role="status"
      data-testid="owner-audio-banner"
      data-state={audio.status}
    >
      <p className="min-w-0 flex-1 text-start text-[0.75rem] leading-5 text-[var(--wesal-muted)]">
        {message}
      </p>
      {audio.status === "failed" ? null : (
        <button
          type="button"
          className="btn-outline !min-h-8 shrink-0 !rounded-full !px-3 !text-[0.72rem]"
          onClick={() => {
            void audio.enable();
          }}
        >
          {t("owner.audio.enable")}
        </button>
      )}
    </div>
  );
}
