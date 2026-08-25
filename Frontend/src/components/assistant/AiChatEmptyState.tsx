"use client";

import { useT } from "@/i18n";

type AiChatEmptyStateProps = {
  disabled?: boolean;
  onPrompt?: (text: string) => void;
};

/**
 * Welcome surface for a session that has no user turns yet. Suggestion chips
 * only hand a phrase to `useAiChat.send` — they do not replace the composer.
 */
export default function AiChatEmptyState({
  disabled = false,
  onPrompt,
}: AiChatEmptyStateProps) {
  const t = useT();
  const hints = [
    { id: "hall", label: t("assistant.chat.empty.hintHall") },
    { id: "howto", label: t("assistant.chat.empty.hintHowTo") },
  ];

  return (
    <div
      className="wesal-ai-chat-empty min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
      data-testid="ai-chat-empty"
    >
      <div className="rounded-2xl bg-white px-4 py-5 text-start sm:px-5 sm:py-6">
        <p className="text-[0.92rem] font-bold text-[var(--wesal-text)]">
          {t("assistant.chat.empty.title")}
        </p>
        <p className="mt-2 text-[0.75rem] leading-6 text-[var(--wesal-muted)]">
          {t("assistant.chat.empty.body")}
        </p>
        {onPrompt ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {hints.map((hint) => (
              <button
                key={hint.id}
                type="button"
                disabled={disabled}
                onClick={() => onPrompt(hint.label)}
                className="wesal-ai-chat-chip max-w-full rounded-full border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-3 py-1.5 text-start text-[0.72rem] text-[var(--wesal-text)] transition hover:border-[var(--wesal-maroon-soft)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {hint.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
