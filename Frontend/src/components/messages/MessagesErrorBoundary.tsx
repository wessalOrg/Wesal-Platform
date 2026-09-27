"use client";

import { Component, type ReactNode } from "react";
import { t } from "@/i18n";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

/** Keeps a thread/inbox render crash from taking down the whole page. */
export default class MessagesErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  handleRetry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) {
      return (
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white px-5 py-8 text-center shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
          data-testid="messages-error-boundary"
        >
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.crashRecover")}</p>
          <button type="button" className="btn-outline mt-4" onClick={this.handleRetry}>
            {t("common.retry")}
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
