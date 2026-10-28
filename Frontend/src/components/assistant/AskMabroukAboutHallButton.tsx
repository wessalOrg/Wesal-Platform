"use client";

import { useAiAssistantLauncher } from "@/components/assistant/AiAssistantContext";
import { useT } from "@/i18n";

type AskMabroukAboutHallButtonProps = {
  hallId: string;
  hallName?: string | null;
  /** `block` fills the width; `inline` sits beside other buttons; `edge` anchors to a card corner. */
  variant?: "block" | "inline" | "edge";
  className?: string;
};

/**
 * "اسأل مبروك عن هذه الصالة" / "Ask Mabrouk about this hall".
 *
 * Opens the existing Mabrouk assistant with THIS hall pinned as the conversation's
 * subject (a previously pinned hall is replaced). It never sends a message or calls the
 * model by itself: the next thing the user types ("كم سعرها؟", "متاحة بكرة؟") is
 * answered about this hall. Intentionally a quiet secondary action — it must not
 * outrank the booking/contact buttons — and it only exists on hall-detail surfaces.
 */
export default function AskMabroukAboutHallButton({
  hallId,
  hallName,
  variant = "block",
  className = "",
}: AskMabroukAboutHallButtonProps) {
  const t = useT();
  const launcher = useAiAssistantLauncher();
  const name = hallName?.trim() || null;

  const aria = name
    ? t("assistant.hallButton.aria", { name })
    : t("assistant.hallButton.ariaGeneric");

  if (variant === "edge") {
    return (
      <button
        type="button"
        data-testid="ask-mabrouk-hall-button"
        disabled={hallId.trim().length === 0}
        aria-label={aria}
        aria-busy={launcher.isStarting || undefined}
        onClick={() => launcher.openWithContext({ id: hallId, name })}
        className={`relative inline-flex w-max max-w-full flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:cursor-not-allowed ${className}`}
      >
        <span className="ask-mabrouk-edge-prompt wesal-text-bold relative z-10 mb-1 max-w-[11rem] rounded-2xl bg-[var(--wesal-white)] px-3 py-1.5 text-center text-xs leading-5 text-[var(--wesal-maroon)] shadow-[0_8px_18px_rgba(193,123,127,0.18)]">
          {t("assistant.hallButton.prompt")}
          <span className="ask-mabrouk-edge-tail absolute -bottom-1 start-5 size-2.5 rotate-45 bg-[var(--wesal-white)]" aria-hidden="true" />
        </span>
        <span className="wesal-mabrouk-ask-avatar relative z-20 -mb-5 h-14 w-14 overflow-hidden rounded-full bg-[var(--wesal-pink)] ring-2 ring-[var(--wesal-white)] shadow-[0_6px_14px_rgba(80,20,40,0.16)]">
          {/* Decorative; the button already names Mabrouk. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assistant/mabrouk-ask.jpg"
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 h-[114%] w-[114%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
          />
        </span>
        <span className="wesal-mabrouk-ask inline-flex items-center gap-2 rounded-full bg-[var(--wesal-maroon)] py-1.5 pe-1.5 ps-3 text-white transition-colors hover:bg-[var(--wesal-maroon-dark)]">
          <ChatIcon />
          <span className="wesal-text-bold text-sm">{t("assistant.hallButton.title")}</span>
          <span className="wesal-mabrouk-ask-chevron grid size-7 place-items-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]" aria-hidden="true">
            <ChevronIcon />
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="ask-mabrouk-hall-button"
      disabled={hallId.trim().length === 0}
      aria-label={aria}
      aria-busy={launcher.isStarting || undefined}
      onClick={() => launcher.openWithContext({ id: hallId, name })}
      className={`wesal-mabrouk-ask inline-flex items-center rounded-full bg-[var(--wesal-maroon)] py-0.5 pe-1 ps-0.5 text-start transition-colors hover:bg-[var(--wesal-maroon-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:cursor-not-allowed ${
        variant === "block" ? "w-full" : "w-auto"
      } ${className}`}
    >
      <span className="wesal-mabrouk-ask-avatar relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--wesal-pink)] ring-2 ring-[var(--wesal-white)] shadow-[0_4px_10px_rgba(80,20,40,0.16)]">
        {/* Decorative; the button already names Mabrouk. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assistant/mabrouk-ask.jpg"
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 h-[114%] w-[114%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
        />
      </span>
      <span className="min-w-0 flex-1 px-1 text-center">
        <span className="wesal-text-bold block text-xs leading-tight text-white">
          {t("assistant.hallButton.title")}
        </span>
        <span className="wesal-text-bold mt-px block text-[0.6rem] leading-tight text-white/90">
          {t("assistant.hallButton.subtitle")}
        </span>
      </span>
      <span className="wesal-mabrouk-ask-chevron grid size-5 shrink-0 place-items-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]" aria-hidden="true">
        <ChevronIcon />
      </span>
    </button>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M6 16.5 4.5 19.5c1.6-.4 2.8-1.1 3.6-1.7A8.2 8.2 0 1 0 6 16.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
