"use client";

import Link from "next/link";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import { useAdminRejectedHalls } from "@/hooks/useAdminRejectedHalls";
import { adminHallSubmissionPath } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

export default function AdminRejectedHallsView() {
  const t = useT();
  const { halls, page, totalPages, loading, errorKey, reload, goToPage } = useAdminRejectedHalls();

  return (
    <div className="seeker-home" data-testid="admin-rejected-halls">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.rejected.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.rejected.subtitle")}</p>
        </div>
      </section>

      {loading ? (
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-rejected-halls-loading"
        />
      ) : null}

      {errorKey ? (
        <section className="seeker-pending-panel" role="alert" data-testid="admin-rejected-halls-error">
          <p className="text-sm text-[var(--wesal-muted)]">{t(errorKey)}</p>
          <button type="button" className="btn-outline mt-4 min-h-11" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {!loading && !errorKey && halls.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="admin-rejected-halls-empty">
          <p>{t("admin.halls.rejected.empty")}</p>
        </div>
      ) : null}

      {halls.length > 0 ? (
        <section className="seeker-pending-panel">
          <ul className="seeker-home-booking-list" data-testid="admin-rejected-halls-list">
            {halls.map((hall) => (
              <li key={hall.hallId} className="seeker-home-booking-row">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--wesal-text)]">{hall.name}</p>
                    <div className="mt-2">
                      <HallApprovalStatusBadge status="Rejected" />
                    </div>
                  </div>
                  <Link
                    href={`${adminHallSubmissionPath(hall.hallId)}?from=rejected`}
                    className="btn-primary min-h-11 px-4 sm:min-h-10"
                    prefetch
                  >
                    {t("admin.halls.rejected.open")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <nav
              className="mt-4 flex flex-wrap items-center justify-between gap-3"
              aria-label={t("admin.halls.rejected.pagination")}
            >
              <button
                type="button"
                className="btn-outline min-h-11 px-4"
                disabled={page <= 1 || loading}
                onClick={() => goToPage(page - 1)}
              >
                {t("admin.halls.rejected.prev")}
              </button>
              <p className="text-sm text-[var(--wesal-muted)]">
                {t("admin.halls.rejected.page", { page, total: totalPages })}
              </p>
              <button
                type="button"
                className="btn-outline min-h-11 px-4"
                disabled={page >= totalPages || loading}
                onClick={() => goToPage(page + 1)}
              >
                {t("admin.halls.rejected.next")}
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
