"use client";

import { useT } from "@/i18n";

type SubscriptionErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function SubscriptionErrorState({
  message,
  onRetry,
}: SubscriptionErrorStateProps) {
  const t = useT();

  return (
    <div className="flex min-h-[6.5rem] flex-col justify-center" role="alert" data-testid="hall-subscription-error">
      <p className="text-sm font-bold text-[var(--wesal-maroon)]">
        {t("owner.subscription.errorTitle")}
      </p>
      <p className="mt-1 break-words text-sm leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]">
        {message}
      </p>
      <button
        type="button"
        className="btn-outline mt-3 min-h-11 w-full sm:w-auto"
        onClick={onRetry}
        data-testid="hall-subscription-retry"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
