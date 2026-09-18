"use client";

import { Component, type ReactNode } from "react";
import SubscriptionErrorState from "@/components/halls/subscription/SubscriptionErrorState";
import { t } from "@/i18n";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

/**
 * Keeps a subscription-widget crash from taking down hall management.
 */
export default class SubscriptionErrorBoundary extends Component<Props, State> {
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
        <SubscriptionErrorState
          message={t("errors.owner.subscription.load")}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
