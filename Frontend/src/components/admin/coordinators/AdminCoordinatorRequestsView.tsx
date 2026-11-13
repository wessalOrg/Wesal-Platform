"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminRequestQueueMobileCard from "@/components/admin/AdminRequestQueueMobileCard";
import { useAdminCoordinatorRequests } from "@/hooks/useAdminCoordinatorRequests";
import { adminCoordinatorRequestPath } from "@/lib/account-profile-path";
import { isAdminCoordinatorFilter } from "@/lib/admin-coordinators-mapper";
import { useT } from "@/i18n";
import type {
  AdminCoordinatorRequestFilter,
  AdminCoordinatorRequestSummary,
  CoordinatorBusinessType,
} from "@/types/admin-coordinators";
import type { AccountApprovalStatus } from "@/types/account-approval";
import "./admin-coordinators.css";

const FILTERS: AdminCoordinatorRequestFilter[] = [
  "Pending",
  "Approved",
  "Rejected",
];

type BusinessFilter = "All" | CoordinatorBusinessType;

function filterLabelKey(filter: AdminCoordinatorRequestFilter): string {
  switch (filter) {
    case "Pending":
      return "admin.coordinators.filter.pending";
    case "Approved":
      return "admin.coordinators.filter.approved";
    case "Rejected":
      return "admin.coordinators.filter.rejected";
  }
}

function statusBadgeClass(status: AccountApprovalStatus): string {
  switch (status) {
    case "Approved":
      return "admin-coord-badge admin-coord-badge--approved";
    case "Rejected":
      return "admin-coord-badge admin-coord-badge--rejected";
    case "NeedsChanges":
      return "admin-coord-badge admin-coord-badge--needs";
    case "Pending":
    default:
      return "admin-coord-badge admin-coord-badge--pending";
  }
}

function statusBadgeKey(status: AccountApprovalStatus): string {
  switch (status) {
    case "Approved":
      return "admin.coordinators.filter.approved";
    case "Rejected":
      return "admin.coordinators.filter.rejected";
    case "NeedsChanges":
      return "admin.coordinators.filter.needsChanges";
    case "Pending":
    default:
      return "admin.coordinators.filter.pending";
  }
}

function businessTypeKey(type: CoordinatorBusinessType): string {
  return type === "Shop"
    ? "admin.coordinators.businessType.shop"
    : "admin.coordinators.businessType.freelance";
}

function formatSubmittedAt(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function initialLetter(row: AdminCoordinatorRequestSummary): string {
  const source = row.fullName || row.displayName || row.email;
  return source.trim().slice(0, 1) || "؟";
}

function matchesSearch(row: AdminCoordinatorRequestSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [row.fullName, row.displayName, row.email]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function AdminCoordinatorRequestsView() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const rawPage = searchParams.get("page");
  const filter: AdminCoordinatorRequestFilter = isAdminCoordinatorFilter(rawStatus)
    ? rawStatus
    : "Pending";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const { items, page: pageData, loading, errorKey, reload } =
    useAdminCoordinatorRequests(filter, page);

  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("All");
  const [search, setSearch] = useState("");

  const locale = useMemo(() => {
    if (typeof document !== "undefined" && document.documentElement.lang === "en") {
      return "en-GB";
    }
    return "ar-EG";
  }, []);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (businessFilter !== "All" && row.businessType !== businessFilter) {
        return false;
      }
      return matchesSearch(row, q);
    });
  }, [items, businessFilter, search]);

  const setFilter = (next: AdminCoordinatorRequestFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", filter);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="seeker-home" data-testid="admin-coordinator-requests">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">
            {t("admin.coordinators.queue.title")}
          </h1>
          <p className="seeker-welcome-body">
            {t("admin.coordinators.queue.subtitle")}
          </p>
        </div>
      </section>

      <section className="admin-coord-card">
        <div className="admin-coord-toolbar" role="search">
          <label className="sr-only" htmlFor="admin-coord-status-filter">
            {t("admin.coordinators.queue.statusFilter")}
          </label>
          <select
            id="admin-coord-status-filter"
            className="admin-coord-select"
            value={filter}
            data-testid="admin-coordinator-status-filter"
            onChange={(event) =>
              setFilter(event.target.value as AdminCoordinatorRequestFilter)
            }
          >
            {FILTERS.map((item) => (
              <option key={item} value={item}>
                {t(filterLabelKey(item))}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="admin-coord-type-filter">
            {t("admin.coordinators.queue.typeFilter")}
          </label>
          <select
            id="admin-coord-type-filter"
            className="admin-coord-select"
            value={businessFilter}
            data-testid="admin-coordinator-type-filter"
            onChange={(event) =>
              setBusinessFilter(event.target.value as BusinessFilter)
            }
          >
            <option value="All">{t("admin.coordinators.queue.typeAll")}</option>
            <option value="Shop">{t("admin.coordinators.businessType.shop")}</option>
            <option value="Freelance">
              {t("admin.coordinators.businessType.freelance")}
            </option>
          </select>

          <label className="sr-only" htmlFor="admin-coord-search">
            {t("admin.coordinators.queue.searchLabel")}
          </label>
          <input
            id="admin-coord-search"
            type="search"
            className="admin-coord-search"
            value={search}
            placeholder={t("admin.coordinators.queue.searchPlaceholder")}
            data-testid="admin-coordinator-search"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div
            className="mx-4 mb-4 h-40 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--wesal-pink)_40%,white)]"
            aria-busy="true"
            data-testid="admin-coordinator-requests-loading"
          />
        ) : null}

        {errorKey ? (
          <div className="px-4 pb-4 text-center" role="alert">
            <p className="text-sm text-[var(--wesal-muted)]">
              {t(
                errorKey.startsWith("admin.")
                  ? errorKey
                  : "admin.coordinators.queue.errors.loadFailed",
              )}
            </p>
            <button type="button" className="btn-outline mt-3" onClick={() => void reload()}>
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {!loading && !errorKey && visibleItems.length === 0 ? (
          <p
            className="px-4 pb-5 text-sm text-[var(--wesal-muted)]"
            data-testid="admin-coordinator-requests-empty"
          >
            {t("admin.coordinators.queue.empty")}
          </p>
        ) : null}

        {!loading && !errorKey && visibleItems.length > 0 ? (
          <>
            <ul
              className="admin-coord-mobile-list"
              data-testid="admin-coordinator-requests-cards"
            >
              {visibleItems.map((row) => (
                <AdminRequestQueueMobileCard
                  key={row.userId}
                  href={adminCoordinatorRequestPath(row.userId)}
                  name={row.fullName || row.displayName || "—"}
                  email={row.email || "—"}
                  meta={`${t(businessTypeKey(row.businessType))} · ${formatSubmittedAt(row.submittedAt, locale)}`}
                  statusClassName={statusBadgeClass(row.approvalStatus)}
                  statusLabel={t(statusBadgeKey(row.approvalStatus))}
                  openLabel={t("admin.coordinators.queue.open")}
                  initial={initialLetter(row)}
                />
              ))}
            </ul>

            <div className="admin-coord-table-wrap admin-coord-table-wrap--desktop">
              <table className="admin-coord-table" data-testid="admin-coordinator-requests-list">
                <thead>
                  <tr>
                    <th scope="col">{t("admin.coordinators.queue.col.name")}</th>
                    <th scope="col">{t("admin.coordinators.queue.col.email")}</th>
                    <th scope="col">{t("admin.coordinators.queue.col.type")}</th>
                    <th scope="col">{t("admin.coordinators.queue.col.date")}</th>
                    <th scope="col">{t("admin.coordinators.queue.col.status")}</th>
                    <th scope="col">{t("admin.coordinators.queue.col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <div className="admin-coord-person">
                          <span className="admin-coord-avatar" aria-hidden="true">
                            {initialLetter(row)}
                          </span>
                          <div className="min-w-0">
                            <p className="admin-coord-person-name">
                              {row.fullName || row.displayName || "—"}
                            </p>
                            {row.displayName ? (
                              <p className="admin-coord-person-meta">{row.displayName}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span dir="ltr" className="admin-coord-email">
                          {row.email || "—"}
                        </span>
                      </td>
                      <td>{t(businessTypeKey(row.businessType))}</td>
                      <td>{formatSubmittedAt(row.submittedAt, locale)}</td>
                      <td>
                        <span className={statusBadgeClass(row.approvalStatus)}>
                          {t(statusBadgeKey(row.approvalStatus))}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={adminCoordinatorRequestPath(row.userId)}
                          className="admin-coord-details-btn"
                          prefetch
                        >
                          <EyeIcon />
                          {t("admin.coordinators.queue.open")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageData.totalPages > 1 ? (
              <div className="admin-coord-pagination" aria-label={t("admin.coordinators.queue.pageNav")}>
                <button
                  type="button"
                  className="admin-coord-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ‹
                </button>
                {pageWindow(page, pageData.totalPages).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`admin-coord-page-btn${
                      n === page ? " admin-coord-page-btn--active" : ""
                    }`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="admin-coord-page-btn"
                  disabled={page >= pageData.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  ›
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
