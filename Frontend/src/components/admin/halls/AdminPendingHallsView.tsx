"use client";

import Link from "next/link";
import MessageHallOwnerButton from "@/components/admin/halls/MessageHallOwnerButton";
import { useAdminPendingHalls } from "@/hooks/useAdminPendingHalls";
import { adminHallSubmissionPath } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

export default function AdminPendingHallsView() {
  const t = useT();
  const { halls, loading, errorKey, reload } = useAdminPendingHalls();

  return (
    <div className="seeker-home" data-testid="admin-pending-halls">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.queue.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.queue.subtitle")}</p>
        </div>
      </section>

      {loading ? (
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-pending-halls-loading"
        />
      ) : null}

      {errorKey ? (
        <section className="seeker-pending-panel" role="alert">
          <p className="text-sm text-[var(--wesal-muted)]">{t(errorKey)}</p>
          <button type="button" className="btn-outline mt-4" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {!loading && !errorKey && halls.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="admin-pending-halls-empty">
          <p>{t("admin.halls.queue.empty")}</p>
        </div>
      ) : null}

      {halls.length > 0 ? (
        <section className="seeker-pending-panel">
          <ul className="seeker-home-booking-list" data-testid="admin-pending-halls-list">
            {halls.map((hall) => (
              <li key={hall.hallId} className="seeker-home-booking-row">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 font-semibold text-[var(--wesal-text)]">{hall.name}</p>
                  <div className="admin-ops-row-actions">
                    <MessageHallOwnerButton hallId={hall.hallId} hallName={hall.name} />
                    <Link
                      href={adminHallSubmissionPath(hall.hallId)}
                      className="btn-primary min-h-10 px-4"
                      prefetch
                    >
                      {t("admin.halls.queue.open")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
