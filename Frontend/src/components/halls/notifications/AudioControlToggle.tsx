"use client";

import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useT } from "@/i18n";

type AudioControlToggleProps = {
  variant?: "icon" | "nav" | "stacked" | "menu";
};

export default function AudioControlToggle({ variant = "icon" }: AudioControlToggleProps) {
  const t = useT();
  const audio = useAudioPermission();
  const label = audio.soundOn
    ? t("owner.audio.mute")
    : t("owner.audio.enable");
  const hint = audio.soundOn
    ? t("owner.audio.muteHint")
    : t("owner.audio.enableHint");
  const state = audio.soundOn ? "on" : audio.status;

  const onToggle = () => {
    void audio.toggleMute();
  };

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        className="wesal-account-menu-item wesal-account-menu-audio"
        aria-pressed={audio.soundOn}
        data-testid="owner-audio-toggle"
        data-state={state}
        onClick={onToggle}
      >
        <span className="wesal-account-menu-icon" aria-hidden="true">
          <SpeakerIcon on={audio.soundOn} className="h-4 w-4" />
        </span>
        <span className="wesal-account-menu-copy">
          <span className="wesal-account-menu-title">{label}</span>
          <span className="wesal-account-menu-desc">{hint}</span>
        </span>
      </button>
    );
  }

  if (variant === "stacked") {
    return (
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 py-2 text-sm font-medium text-[var(--wesal-text)]"
        aria-pressed={audio.soundOn}
        aria-label={label}
        data-testid="owner-audio-toggle"
        data-state={state}
        onClick={onToggle}
      >
        <span className="text-[var(--wesal-maroon)]">
          <SpeakerIcon on={audio.soundOn} />
        </span>
        {label}
      </button>
    );
  }

  if (variant === "nav") {
    return (
      <button
        type="button"
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] ${
          audio.soundOn
            ? "bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"
            : "text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink)]/70"
        }`}
        aria-pressed={audio.soundOn}
        aria-label={label}
        title={label}
        data-testid="owner-audio-toggle"
        data-state={state}
        onClick={onToggle}
      >
        <SpeakerIcon on={audio.soundOn} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wesal-maroon)] transition hover:bg-white active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] sm:h-11 sm:w-11 ${
        audio.soundOn
          ? "bg-white/80"
          : "bg-transparent opacity-80"
      }`}
      aria-pressed={audio.soundOn}
      aria-label={label}
      title={label}
      data-testid="owner-audio-toggle"
      data-state={state}
      onClick={onToggle}
    >
      <SpeakerIcon on={audio.soundOn} />
    </button>
  );
}

function SpeakerIcon({
  on,
  className = "h-5 w-5",
}: {
  on: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 9.5v5h3.2L12 18.2V5.8L7.7 9.5H4.5Z" />
      {on ? (
        <>
          <path d="M15.2 9.2a3.4 3.4 0 0 1 0 5.6" />
          <path d="M17.4 7a6 6 0 0 1 0 10" />
        </>
      ) : (
        <path d="M16.2 9.2 20 15.8M20 9.2 16.2 15.8" />
      )}
    </svg>
  );
}
