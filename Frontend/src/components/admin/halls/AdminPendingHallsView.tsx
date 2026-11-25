"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MessageHallOwnerButton from "@/components/admin/halls/MessageHallOwnerButton";
import { useAdminPendingHalls } from "@/hooks/useAdminPendingHalls";
import { adminHallSubmissionPath, parseAdminPendingPage } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

export default function AdminPendingHallsView() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const page = parseAdminPendingPage(new URLSearchParams(query).get("page"));
  const goToPage = useCallback((nextPage: number) => {
    if (nextPage === page) return;
    const params = new URLSearchParams(query);
    if (nextPage <= 1) params.delete("page"); else params.set("page", String(nextPage));
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [page, pathname, query, router]);
  const { halls, loading, errorKey, reload, totalCount, totalPages } = useAdminPendingHalls(page, goToPage);

  return (
    <div className="seeker-home" data-testid="admin-pending-halls">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.queue.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.queue.subtitle")}</p>
          {totalCount !== null ? <p className="mt-2 text-sm text-[var(--wesal-muted)]" aria-live="polite" data-testid="admin-pending-total">
            {t("admin.halls.queue.count", { count: totalCount })}
          </p> : null}
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
        <section className={`seeker-pending-panel ${loading ? "pointer-events-none opacity-60" : ""}`} aria-busy={loading}>
          <ul className="seeker-home-booking-list" data-testid="admin-pending-halls-list">
            {halls.map((hall) => (
              <li key={hall.hallId} className="seeker-home-booking-row">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="min-w-0 font-semibold text-[var(--wesal-text)]">{hall.name}</p>
                  <div className="admin-ops-row-actions">
                    <MessageHallOwnerButton hallId={hall.hallId} hallName={hall.name} />
                    <Link
                      href={adminHallSubmissionPath(hall.hallId, page)}
                      className="btn-primary !min-h-9 px-3.5 text-sm sm:!min-h-9"
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
      {totalPages > 1 ? <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label={t("admin.halls.queue.pagination")} aria-busy={loading}>
        <button type="button" className="btn-outline min-h-11 px-4" data-testid="admin-pending-prev"
          disabled={page <= 1} onClick={() => goToPage(page - 1)}>{t("admin.halls.queue.prev")}</button>
        <p className="text-sm text-[var(--wesal-muted)]" aria-live="polite">{t("admin.halls.queue.page", { page, total: totalPages })}</p>
        <button type="button" className="btn-outline min-h-11 px-4" data-testid="admin-pending-next"
          disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>{t("admin.halls.queue.next")}</button>
      </nav> : null}
    </div>
  );
}
