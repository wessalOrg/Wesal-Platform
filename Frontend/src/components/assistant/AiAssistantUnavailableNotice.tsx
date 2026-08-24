"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import type { AiUnavailableReason } from "@/types/ai-assistant";

type AiAssistantUnavailableNoticeProps = {
  reason: AiUnavailableReason | null;
  /** i18n key for the failure body copy. */
  messageKey: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onBrowseHalls: () => void;
};

function resolveTitleKey(
  reason: AiUnavailableReason | null,
  messageKey: string | null,
): string {
  if (reason === "network") return "assistant.network.title";
  if (messageKey === "errors.assistant.language") return "assistant.error.title";
  return "assistant.unavailable.title";
}

/**
 * Offline / unavailable state for the assistant panel. Purely presentational:
 * it renders whatever failure `useAiAssistant` reports, and offers the two ways
 * out — keep using the platform manually, or reconnect in place without a reload.
 */
export default function AiAssistantUnavailableNotice({
  reason,
  messageKey,
  isRetrying,
  onRetry,
  onBrowseHalls,
}: AiAssistantUnavailableNoticeProps) {
  const t = useT();

  return (
    <div
      role="alert"
      aria-busy={isRetrying}
      data-testid="ai-assistant-unavailable"
      className="rounded-2xl bg-white px-5 py-6 text-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto h-11 w-11 text-[var(--wesal-muted)]"
      >
        <path d="M2.5 8.9a14 14 0 0 1 4.4-2.8" />
        <path d="M17.1 6.1a14 14 0 0 1 4.4 2.8" />
        <path d="M5.6 12.5a9.5 9.5 0 0 1 4.1-2.4" />
        <path d="M14.3 10.1a9.5 9.5 0 0 1 4.1 2.4" />
        <path d="M9 16.1a4.5 4.5 0 0 1 6 0" />
        <circle cx="12" cy="19.4" r="0.9" fill="currentColor" stroke="none" />
        <path d="M2.4 2.4l19.2 19.2" />
      </svg>

      <h3 className="mt-3 text-[0.95rem] font-bold text-[var(--wesal-text)]">
        {t(resolveTitleKey(reason, messageKey))}
      </h3>
      <p className="mx-auto mt-2 max-w-[16rem] text-[0.72rem] leading-6 text-[var(--wesal-muted)]">
        {t(messageKey ?? "errors.assistant.init")}
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        <Link
          href="/halls"
          onClick={onBrowseHalls}
          className="btn-primary w-full !text-[0.8rem]"
          data-testid="ai-assistant-browse-halls"
        >
          {t("assistant.browseHalls")}
        </Link>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="btn-outline w-full gap-2 !text-[0.8rem] disabled:cursor-not-allowed disabled:opacity-70"
          data-testid="ai-assistant-retry"
        >
          {isRetrying ? (
            <>
              <span className="wesal-ai-spinner" aria-hidden="true" />
              {t("assistant.retrying")}
            </>
          ) : (
            t("assistant.reconnect")
          )}
        </button>
      </div>
    </div>
  );
}
