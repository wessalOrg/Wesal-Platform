"use client";

import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import { useAiAssistantLauncher } from "@/components/assistant/AiAssistantContext";
import { useT } from "@/i18n";
import { isValidHallId } from "@/lib/wesal-routes";

type AskMabroukAboutHallButtonProps = {
  hallId: string;
  hallName?: string | null;
  /** `block` fills the width (hall page action column); `inline` sits beside other buttons. */
  variant?: "block" | "inline";
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
  const valid = isValidHallId(hallId);
  const name = hallName?.trim() || null;

  const label = t("assistant.hallButton");
  const aria = name
    ? t("assistant.hallButton.aria", { name })
    : t("assistant.hallButton.ariaGeneric");

  return (
    <button
      type="button"
      data-testid="ask-mabrouk-hall-button"
      disabled={!valid}
      aria-label={aria}
      aria-busy={launcher.isStarting || undefined}
      onClick={() => launcher.openWithContext({ id: hallId, name })}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--wesal-maroon-soft)] bg-[var(--wesal-pink-soft)] px-3.5 text-sm font-bold text-[var(--wesal-maroon-dark)] transition hover:bg-[var(--wesal-pink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "block" ? "w-full" : "w-auto"
      } ${className}`}
    >
      <AiAssistantSparkIcon className="h-4 w-4 shrink-0 text-[var(--wesal-maroon)]" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
