"use client";

import type { ReactNode } from "react";
import AiChatEmptyState from "@/components/assistant/AiChatEmptyState";
import AiChatErrorBanner from "@/components/assistant/AiChatErrorBanner";
import { useT } from "@/i18n";
import type { AiChatSurface } from "@/types/ai-chat";

type AiChatShellProps = {
  surface: AiChatSurface;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  onPrompt?: (text: string) => void;
  children?: ReactNode;
};

function AiChatLoadingSkeleton() {
  const t = useT();

  return (
    <div
      className="wesal-ai-chat-skeleton min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-4"
      data-testid="ai-chat-skeleton"
    >
      <span className="sr-only">{t("assistant.chat.loadingLabel")}</span>
      <div className="wesal-ai-chat-skel-bubble w-[78%]" aria-hidden="true">
        <i className="wesal-ai-chat-skel-line w-[92%]" />
        <i className="wesal-ai-chat-skel-line w-[64%]" />
      </div>
      <div className="wesal-ai-chat-skel-bubble wesal-ai-chat-skel-bubble-user ms-auto w-[46%]" aria-hidden="true">
        <i className="wesal-ai-chat-skel-line w-[80%]" />
      </div>
      <div className="wesal-ai-chat-skel-bubble w-[70%]" aria-hidden="true">
        <i className="wesal-ai-chat-skel-line w-[88%]" />
        <i className="wesal-ai-chat-skel-line w-[52%]" />
      </div>
    </div>
  );
}

/**
 * Conversation chrome: empty / loading / failure / idle. Message bubbles and
 * the question field stay in their own components.
 */
export default function AiChatShell({
  surface,
  canRetry,
  isRetrying,
  onRetry,
  onPrompt,
  children,
}: AiChatShellProps) {
  const showBanner = surface === "failure" && canRetry;
  const showEmpty = surface === "empty";
  const showSkeleton = surface === "loading" && !children;

  return (
    <div
      className="wesal-ai-chat-shell flex min-h-0 min-w-0 flex-1 flex-col"
      data-testid="ai-chat-shell"
      data-surface={surface}
    >
      {showBanner ? (
        <AiChatErrorBanner isRetrying={isRetrying} onRetry={onRetry} />
      ) : null}

      {showEmpty ? (
        <AiChatEmptyState disabled={isRetrying} onPrompt={onPrompt} />
      ) : showSkeleton ? (
        <AiChatLoadingSkeleton />
      ) : (
        children
      )}
    </div>
  );
}
