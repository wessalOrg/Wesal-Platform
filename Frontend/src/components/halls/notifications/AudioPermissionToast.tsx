"use client";

import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useT } from "@/i18n";

export default function AudioPermissionToast() {
  const t = useT();
  const audio = useAudioPermission();

  if (!audio.missedAlert || audio.soundOn) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex justify-center sm:inset-x-auto sm:start-4 sm:justify-start"
      data-testid="owner-audio-toast"
    >
      <div
        className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 shadow-[0_12px_30px_rgba(90,55,45,0.14)]"
        role="status"
      >
        <p className="min-w-0 flex-1 text-start text-[0.75rem] leading-5 text-[var(--wesal-text)]">
          {t("owner.audio.blockedHint")}
        </p>
        <button
          type="button"
          className="btn-primary !min-h-8 shrink-0 !rounded-full !px-3 !text-[0.72rem]"
          onClick={() => {
            void audio.enable();
          }}
        >
          {t("owner.audio.enable")}
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)]"
          aria-label={t("common.close")}
          onClick={audio.dismissMissedAlert}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
