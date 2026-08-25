"use client";

import { useT } from "@/i18n";

/** Card-shaped placeholders while `/recommend` is in flight. */
export default function AiHallRecommendationSkeleton() {
  const t = useT();

  return (
    <div
      className="wesal-ai-hall-skel space-y-2"
      data-testid="ai-chat-recommend-skeleton"
      aria-live="polite"
    >
      <span className="sr-only">{t("assistant.chat.recommend.loading")}</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white p-2.5"
          aria-hidden="true"
        >
          <i className="wesal-ai-hall-skel-thumb wesal-ai-chat-skel-line" />
          <div className="min-w-0 flex-1 py-0.5">
            <i className="wesal-ai-chat-skel-line w-[72%]" />
            <i className="wesal-ai-chat-skel-line mt-2 w-[48%]" />
            <i className="wesal-ai-chat-skel-line mt-3 w-[36%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
