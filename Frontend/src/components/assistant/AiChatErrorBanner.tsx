"use client";

import { useT } from "@/i18n";

type AiChatErrorBannerProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

/** Inline request-failure strip. Retry re-dispatches the last turn in place. */
export default function AiChatErrorBanner({
  isRetrying,
  onRetry,
}: AiChatErrorBannerProps) {
  const t = useT();

  return (
    <div
      role="alert"
      aria-busy={isRetrying}
      data-testid="ai-chat-error-banner"
      className="wesal-ai-chat-banner shrink-0 border-b border-[var(--wesal-border)] bg-[#fbf4f2] px-3 py-2.5 sm:px-4"
    >
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:gap-2.5">
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[0.75rem] font-bold text-[var(--wesal-text)]">
            {t("assistant.chat.retryTitle")}
          </p>
          <p className="mt-0.5 text-[0.68rem] leading-5 text-[var(--wesal-muted)]">
            {t("assistant.chat.retryBody")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          data-testid="ai-chat-retry"
          className="btn-outline mt-0.5 inline-flex shrink-0 items-center justify-center gap-1.5 !px-3 !py-1.5 !text-[0.72rem] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRetrying ? (
            <>
              <span className="wesal-ai-spinner" aria-hidden="true" />
              {t("assistant.retrying")}
            </>
          ) : (
            t("assistant.chat.retry")
          )}
        </button>
      </div>
    </div>
  );
}
