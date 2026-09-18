"use client";

import { usePathname } from "next/navigation";
import HallSidebarItem from "@/components/owner-management/halls/HallSidebarItem";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { ownerHallPath } from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";

type HallOwnerHallsSectionProps = {
  onNavigate?: () => void;
};

/**
 * Responsive Hall Owner halls list with live approval statuses (US-OWNER-05).
 * Data comes from useHallOwnerHalls — no duplicate API layer.
 */
export default function HallOwnerHallsSection({
  onNavigate,
}: HallOwnerHallsSectionProps) {
  const t = useT();
  const pathname = usePathname();
  const { halls, isLoading, status, errorKey, isRefreshing, refetch } =
    useHallOwnerHalls();

  const showInitialError = status === "error";
  const showSoftError = Boolean(errorKey) && status === "ready" && halls.length > 0;
  const retryDisabled = isLoading || isRefreshing;

  return (
    <div
      className="owner-halls-section"
      data-testid="owner-halls-section"
      data-state={isLoading ? "loading" : showInitialError ? "error" : "ready"}
      data-hall-count={isLoading ? undefined : halls.length}
    >
      <div className="owner-halls-section-header">
        <p className="owner-halls-section-title">
          {t("owner.management.halls.sectionTitle")}
        </p>
        {isRefreshing ? (
          <span className="owner-halls-refreshing" role="status">
            {t("owner.management.halls.refreshing")}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <ul className="owner-halls-skeleton" aria-busy="true" aria-label={t("common.loading")}>
          <li className="owner-halls-skeleton-row" />
          <li className="owner-halls-skeleton-row" />
          <li className="owner-halls-skeleton-row" />
        </ul>
      ) : null}

      {showInitialError ? (
        <div className="owner-halls-error" role="alert">
          <p className="owner-halls-error-text">
            {t(errorKey ?? "owner.management.halls.loadError")}
          </p>
          <button
            type="button"
            className="owner-halls-retry"
            disabled={retryDisabled}
            aria-busy={retryDisabled || undefined}
            data-testid="owner-halls-retry"
            onClick={() => {
              if (retryDisabled) return;
              refetch();
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {!isLoading && !showInitialError && halls.length === 0 ? (
        <p className="owner-halls-empty" data-testid="owner-halls-empty">
          {t("owner.management.halls.empty")}
        </p>
      ) : null}

      {!isLoading && !showInitialError && halls.length > 0 ? (
        <ul className="owner-halls-list" data-testid="owner-halls-list">
          {halls.map((hall) => {
            const href = ownerHallPath(hall.id);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={hall.id} className="owner-halls-list-item">
                <HallSidebarItem
                  hall={hall}
                  active={active}
                  onNavigate={onNavigate}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {showSoftError ? (
        <div className="owner-halls-soft-error" role="status">
          <p className="owner-halls-error-text">
            {t(errorKey ?? "owner.management.halls.loadError")}
          </p>
          <button
            type="button"
            className="owner-halls-retry"
            disabled={retryDisabled}
            onClick={() => {
              if (retryDisabled) return;
              refetch();
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
