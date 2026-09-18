"use client";

import SubscriptionErrorState from "@/components/halls/subscription/SubscriptionErrorState";
import SubscriptionReadyPanel from "@/components/halls/subscription/SubscriptionReadyPanel";
import SubscriptionStatusSkeleton from "@/components/halls/subscription/SubscriptionStatusSkeleton";
import { useT } from "@/i18n";
import { subscriptionCardToneClass } from "@/lib/owner-subscription-ui";
import type { HallSubscription, HallSubscriptionLoadStatus } from "@/types/hall-subscription";
import "@/components/halls/subscription/subscription-status.css";

export type SubscriptionStatusCardProps = {
  hallId: string;
  hallName?: string;
  loadStatus: HallSubscriptionLoadStatus;
  subscription: HallSubscription | null;
  errorMessage?: string | null;
  onRetry: () => void;
};

export default function SubscriptionStatusCard({
  hallId,
  hallName,
  loadStatus,
  subscription,
  errorMessage,
  onRetry,
}: SubscriptionStatusCardProps) {
  const t = useT();
  const isError =
    loadStatus === "unauthorized" ||
    loadStatus === "forbidden" ||
    loadStatus === "not_found" ||
    loadStatus === "error";
  const tone = isError
    ? "error"
    : loadStatus === "ready" && subscription
      ? subscription.status
      : "loading";

  return (
    <section
      className={`hall-subscription-card rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.06)] sm:p-5 ${subscriptionCardToneClass(tone)}`}
      aria-labelledby={`hall-subscription-heading-${hallId}`}
      data-testid="hall-subscription-status"
      data-hall-id={hallId}
      data-load-status={loadStatus}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id={`hall-subscription-heading-${hallId}`}
          className="min-w-0 break-words text-base font-bold text-[var(--wesal-text)] [overflow-wrap:anywhere] sm:text-lg"
        >
          {t("owner.subscription.title")}
        </h2>
        <p
          className="max-w-full break-all text-[0.68rem] font-medium text-[var(--wesal-muted)]"
          dir="ltr"
        >
          {hallId}
        </p>
      </div>

      <div className="hall-subscription-body mt-3 min-w-0">
        {loadStatus === "loading" || loadStatus === "idle" ? <SubscriptionStatusSkeleton /> : null}
        {loadStatus === "ready" && subscription ? (
          <SubscriptionReadyPanel subscription={subscription} hallName={hallName} />
        ) : null}
        {isError ? (
          <SubscriptionErrorState
            message={errorMessage || t("errors.owner.subscription.load")}
            onRetry={onRetry}
          />
        ) : null}
      </div>
    </section>
  );
}
