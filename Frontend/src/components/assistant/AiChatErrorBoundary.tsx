"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "@/i18n";

type CrashFallbackProps = {
  onRetry: () => void;
};

function AiChatCrashFallback({ onRetry }: CrashFallbackProps) {
  const t = useT();

  return (
    <div
      role="alert"
      data-testid="ai-chat-crash"
      className="wesal-ai-chat-crash min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
    >
      <div className="rounded-2xl bg-white px-4 py-6 text-start sm:px-5">
        <p className="text-[0.92rem] font-bold text-[var(--wesal-text)]">
          {t("assistant.chat.crashTitle")}
        </p>
        <p className="mt-2 text-[0.75rem] leading-6 text-[var(--wesal-muted)]">
          {t("assistant.chat.crashBody")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          data-testid="ai-chat-crash-retry"
          className="btn-outline mt-4 inline-flex items-center gap-2 !text-[0.8rem]"
        >
          {t("assistant.chat.retry")}
        </button>
      </div>
    </div>
  );
}

type AiChatErrorBoundaryProps = {
  children: ReactNode;
};

type AiChatErrorBoundaryState = {
  error: Error | null;
};

/**
 * Isolates a render crash in the conversation surface so the rest of the
 * assistant (header, composer, floating button) can keep working.
 */
export default class AiChatErrorBoundary extends Component<
  AiChatErrorBoundaryProps,
  AiChatErrorBoundaryState
> {
  state: AiChatErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AiChatErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Wesal] AI chat surface failed to render", error, info);
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <AiChatCrashFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
