"use client";

import { useEffect, useRef } from "react";
import AiChatMessageBubble from "@/components/assistant/AiChatMessage";
import AiHallRecommendationSkeleton from "@/components/assistant/AiHallRecommendationSkeleton";
import { useT } from "@/i18n";
import type { AiChatMessage } from "@/types/ai-chat";

type AiChatThreadProps = {
  messages: AiChatMessage[];
  isSending: boolean;
  isRecommending?: boolean;
};

/** Scrollable conversation history. Presentation only. */
export default function AiChatThread({
  messages,
  isSending,
  isRecommending = false,
}: AiChatThreadProps) {
  const t = useT();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending, isRecommending]);

  return (
    <div
      className="wesal-ai-panel-body min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4"
      data-testid="ai-chat-thread"
    >
      {messages.map((message) => (
        <AiChatMessageBubble key={message.id} message={message} />
      ))}

      {isSending ? (
        isRecommending ? (
          <AiHallRecommendationSkeleton />
        ) : (
          <div
            className="w-fit rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3"
            data-testid="ai-chat-loading"
            aria-live="polite"
          >
            <span className="sr-only">{t("assistant.chat.thinking")}</span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <i className="wesal-ai-dot" />
              <i className="wesal-ai-dot" />
              <i className="wesal-ai-dot" />
            </span>
          </div>
        )
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
