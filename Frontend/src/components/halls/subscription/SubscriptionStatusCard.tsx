"use client";

import SubscriptionErrorState from "@/components/halls/subscription/SubscriptionErrorState";
import SubscriptionReadyPanel from "@/components/halls/subscription/SubscriptionReadyPanel";
import SubscriptionStatusBadge from "@/components/halls/subscription/SubscriptionStatusBadge";
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
  embedded?: boolean;
};

export default function SubscriptionStatusCard({
  hallId,
  hallName,
  loadStatus,
  subscription,
  errorMessage,
  onRetry,
  embedded = false,
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
  const isActive = tone === "active";
  const readySubscription =
    loadStatus === "ready" && subscription != null ? subscription : null;

  return (
    <section
      className={`hall-subscription-card h-auto w-full max-w-full overflow-hidden self-start ${
        embedded
          ? "rounded-2xl border p-3.5 sm:p-4"
          : "rounded-[1.4rem] border bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.06)] sm:p-5"
      } ${subscriptionCardToneClass(tone)}`}
      aria-labelledby={`hall-subscription-heading-${hallId}`}
      data-testid="hall-subscription-status"
      data-hall-id={hallId}
      data-load-status={loadStatus}
    >
      <div className="grid min-w-0 grid-cols-1 gap-3">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[0.72rem] font-bold tracking-wide ${
                isActive ? "text-[#059669]" : "text-[var(--wesal-muted)]"
              }`}
            >
              {t("owner.subscription.title")}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h2
                id={`hall-subscription-heading-${hallId}`}
                className={`hall-subscription-title min-w-0 truncate text-base font-extrabold leading-snug sm:text-lg ${
                  isActive ? "" : "text-[var(--wesal-maroon-dark)]"
                }`}
                data-testid="hall-subscription-hall-name"
              >
                {hallName?.trim() || t("owner.subscription.title")}
              </h2>
              {isActive ? (
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#047857] text-white shadow-[0_6px_14px_rgba(4,120,87,0.28)]"
                  aria-hidden="true"
                >
                  <CrownIcon />
                </span>
              ) : null}
            </div>
          </div>

          {readySubscription ? (
            <div className="shrink-0">
              <SubscriptionStatusBadge status={readySubscription.status} />
            </div>
          ) : null}
        </header>

        <div className="hall-subscription-body min-w-0">
          {loadStatus === "loading" || loadStatus === "idle" ? (
            <SubscriptionStatusSkeleton />
          ) : null}
          {readySubscription ? (
            <SubscriptionReadyPanel
              subscription={readySubscription}
              showIllustration={isActive}
            />
          ) : null}
          {isError ? (
            <SubscriptionErrorState
              message={errorMessage || t("errors.owner.subscription.load")}
              onRetry={onRetry}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
      <path
        d="M4.5 17.5h15M5 17.5 6.2 9.8l4 3.4L12 7.5l1.8 5.7 4-3.4 1.2 7.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M5 17.5h14v1.6a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.1v-1.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
