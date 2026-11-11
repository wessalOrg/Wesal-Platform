"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminActionToolbar, {
  type AdminModerationAction,
} from "@/components/admin/moderation/AdminActionToolbar";
import AdminModerationThumb from "@/components/admin/moderation/AdminModerationThumb";
import DeletePostModal from "@/components/admin/moderation/DeletePostModal";
import ModerationSuccessModal from "@/components/admin/moderation/ModerationSuccessModal";
import RestrictionModal from "@/components/admin/moderation/RestrictionModal";
import UnlockAccountDialog from "@/components/admin/moderation/UnlockAccountDialog";
import SuccessToast from "@/components/ui/SuccessToast";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatLockPeriodHours } from "@/lib/admin-moderation-mapper";
import {
  deleteModeratedOffer,
  deleteModeratedPost,
  fetchAdminModeratedOffers,
  fetchAdminModeratedPosts,
  lockProfessionalAccount,
  unlockProfessionalAccount,
} from "@/services/admin-moderation";
import type { AdminModeratedContent } from "@/types/admin-moderation";

type ContentFilter = "all" | "posts" | "offers";
type RoleFilter = "all" | "EventCoordinator" | "Photographer";
type StatusFilter = "all" | "published" | "restricted" | "offer";

type BusyAction = "delete" | "lock" | "unlock" | null;

export default function AdminPostsManagementPage() {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState<AdminModeratedContent[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminModeratedContent | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminModeratedContent | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<AdminModeratedContent | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [successVariant, setSuccessVariant] = useState<"postDeleted" | "userRestricted" | null>(
    null,
  );
  const [lockSuccess, setLockSuccess] = useState<{
    name: string;
    roleLabel: string;
    period: string;
    hours: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      const ownerRole = roleFilter === "all" ? undefined : roleFilter;
      const query = { page, pageSize, ownerRole };
      const [postsPage, offersPage] = await Promise.all([
        contentFilter === "offers"
          ? Promise.resolve({
              items: [] as AdminModeratedContent[],
              pageNumber: 1,
              pageSize,
              totalCount: 0,
              totalPages: 0,
            })
          : fetchAdminModeratedPosts(query),
        contentFilter === "posts"
          ? Promise.resolve({
              items: [] as AdminModeratedContent[],
              pageNumber: 1,
              pageSize,
              totalCount: 0,
              totalPages: 0,
            })
          : fetchAdminModeratedOffers(query),
      ]);

      let merged =
        contentFilter === "posts"
          ? postsPage.items
          : contentFilter === "offers"
            ? offersPage.items
            : [...postsPage.items, ...offersPage.items].sort((a, b) => {
                const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
                const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
                return bTime - aTime;
              });

      const q = appliedSearch.trim().toLowerCase();
      if (q) {
        merged = merged.filter((item) => {
          const hay = `${item.ownerDisplayName} ${item.content ?? ""} ${item.ownerRole}`.toLowerCase();
          return hay.includes(q);
        });
      }

      if (statusFilter === "restricted") {
        merged = merged.filter((item) => item.ownerIsLocked);
      } else if (statusFilter === "published") {
        merged = merged.filter(
          (item) => item.kind === "post" && !item.ownerIsLocked,
        );
      } else if (statusFilter === "offer") {
        merged = merged.filter((item) => item.kind === "offer");
      }

      const count =
        contentFilter === "all"
          ? postsPage.totalCount + offersPage.totalCount
          : contentFilter === "posts"
            ? postsPage.totalCount
            : offersPage.totalCount;

      setItems(merged);
      setTotalCount(count);
      setTotalPages(
        Math.max(
          1,
          contentFilter === "all"
            ? Math.max(postsPage.totalPages, offersPage.totalPages, 1)
            : contentFilter === "posts"
              ? postsPage.totalPages || 1
              : offersPage.totalPages || 1,
        ),
      );
    } catch (err) {
      setErrorKey(
        err instanceof ApiError ? err.message : "admin.moderation.errors.loadFailed",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, contentFilter, page, roleFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel = useCallback(
    (role: string) => {
      const normalized = role.trim().toLowerCase();
      if (normalized === "photographer") return t("admin.moderation.role.photographer");
      if (
        normalized === "eventcoordinator" ||
        normalized === "coordinator"
      ) {
        return t("admin.moderation.role.coordinator");
      }
      return role || t("admin.moderation.role.unknown");
    },
    [t],
  );

  function statusBadge(item: AdminModeratedContent) {
    if (item.ownerIsLocked) {
      return {
        label: t("admin.moderation.status.restricted"),
        className: "bg-[color-mix(in_srgb,#7a5af8_14%,white)] text-[#5925dc]",
        dot: "bg-[#7a5af8]",
      };
    }
    if (item.kind === "offer") {
      const status = (item.status ?? "").toLowerCase();
      if (status === "scheduled") {
        return {
          label: t("admin.moderation.status.review"),
          className: "bg-[color-mix(in_srgb,#f79009_14%,white)] text-[#b54708]",
          dot: "bg-[#f79009]",
        };
      }
      if (status === "ended" || status === "stopped") {
        return {
          label: t("admin.moderation.status.rejected"),
          className: "bg-[color-mix(in_srgb,#f04438_14%,white)] text-[#b42318]",
          dot: "bg-[#f04438]",
        };
      }
      return {
        label: t("admin.moderation.status.published"),
        className: "bg-[color-mix(in_srgb,#12b76a_14%,white)] text-[#027a48]",
        dot: "bg-[#12b76a]",
      };
    }
    return {
      label: t("admin.moderation.status.published"),
      className: "bg-[color-mix(in_srgb,#12b76a_14%,white)] text-[#027a48]",
      dot: "bg-[#12b76a]",
    };
  }

  function typeBadge(item: AdminModeratedContent) {
    if (item.kind === "offer") {
      return t("admin.moderation.type.offer");
    }
    return roleLabel(item.ownerRole);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const handleAction = useCallback(
    (action: AdminModerationAction, item: AdminModeratedContent) => {
      setActionError(null);
      if (action === "view") {
        if (item.kind === "post") {
          router.push(`/posts/${encodeURIComponent(item.id)}`);
        } else {
          router.push(`/professionals/${encodeURIComponent(item.ownerUserId)}`);
        }
        return;
      }
      if (action === "deleteContent") {
        setDeleteTarget(item);
        return;
      }
      if (action === "lock") {
        setLockTarget(item);
        return;
      }
      if (action === "unlock") {
        setUnlockTarget(item);
      }
    },
    [router],
  );

  async function confirmDelete(reason: string) {
    if (!deleteTarget) return;
    setBusy("delete");
    setActionError(null);
    try {
      if (deleteTarget.kind === "post") {
        await deleteModeratedPost(deleteTarget.id, reason);
      } else {
        await deleteModeratedOffer(deleteTarget.id, reason);
      }
      setDeleteTarget(null);
      setSuccessVariant("postDeleted");
      void load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "admin.moderation.errors.deleteFailed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmLock(payload: { durationHours: number; reason: string }) {
    if (!lockTarget) return;
    setBusy("lock");
    setActionError(null);
    try {
      await lockProfessionalAccount(lockTarget.ownerUserId, {
        durationHours: payload.durationHours,
        reason: payload.reason || null,
      });
      const period = formatLockPeriodHours(payload.durationHours, t);
      setLockSuccess({
        name: lockTarget.ownerDisplayName,
        roleLabel: roleLabel(lockTarget.ownerRole),
        period,
        hours: payload.durationHours,
      });
      setLockTarget(null);
      setSuccessVariant("userRestricted");
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError("admin.moderation.errors.alreadyLocked");
      } else {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "admin.moderation.errors.lockFailed",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function confirmUnlock() {
    if (!unlockTarget) return;
    setBusy("unlock");
    setActionError(null);
    try {
      await unlockProfessionalAccount(unlockTarget.ownerUserId);
      setUnlockTarget(null);
      setToast(t("admin.moderation.accountUnlock.success"));
      void load();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "admin.moderation.errors.unlockFailed",
      );
    } finally {
      setBusy(null);
    }
  }

  const pageNumbers = useMemo(() => {
    const max = Math.min(totalPages, 5);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [totalPages]);

  return (
    <div className="space-y-5" data-testid="admin-posts-management">
      <section className="overflow-hidden rounded-[1.25rem] border border-[var(--wesal-border)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_12%,white),var(--wesal-pink-soft))] px-5 py-5 sm:px-6">
        <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)] sm:text-2xl">
          {t("admin.moderation.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--wesal-muted)]">
          {t("admin.moderation.subtitle")}
        </p>
      </section>

      <section className="rounded-[1.25rem] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_0.5rem_1.5rem_rgba(90,55,45,0.04)] sm:p-5">
        <form
          className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setAppliedSearch(search);
          }}
        >
          <label className="min-w-0 flex-1 space-y-1">
            <span className="sr-only">{t("admin.moderation.searchLabel")}</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-muted)]">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.moderation.searchPlaceholder")}
                className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white pe-3 ps-10 text-sm outline-none focus:border-[var(--wesal-maroon)]"
                data-testid="admin-moderation-search"
              />
            </div>
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm lg:w-auto"
            aria-label={t("admin.moderation.filters.status")}
          >
            <option value="all">{t("admin.moderation.filters.statusAll")}</option>
            <option value="published">{t("admin.moderation.status.published")}</option>
            <option value="restricted">{t("admin.moderation.status.restricted")}</option>
            <option value="offer">{t("admin.moderation.type.offer")}</option>
          </select>

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as RoleFilter);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm lg:w-auto"
            aria-label={t("admin.moderation.filters.role")}
          >
            <option value="all">{t("admin.moderation.filters.roleAll")}</option>
            <option value="Photographer">{t("admin.moderation.role.photographer")}</option>
            <option value="EventCoordinator">
              {t("admin.moderation.role.coordinator")}
            </option>
          </select>

          <select
            value={contentFilter}
            onChange={(event) => {
              setContentFilter(event.target.value as ContentFilter);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm lg:w-auto"
            aria-label={t("admin.moderation.filters.type")}
          >
            <option value="all">{t("admin.moderation.filters.typeAll")}</option>
            <option value="posts">{t("admin.moderation.filters.posts")}</option>
            <option value="offers">{t("admin.moderation.filters.offers")}</option>
          </select>

          <button type="submit" className="btn-primary min-h-11 px-5">
            {t("admin.moderation.filters.apply")}
          </button>
        </form>

        {loading ? (
          <div
            className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
            aria-busy="true"
          />
        ) : null}

        {errorKey ? (
          <div className="mt-5 rounded-2xl border border-[#f5c6c2] bg-[#fdecea] p-4" role="alert">
            <p className="text-sm text-[#b42318]">
              {errorKey.startsWith("admin.") || errorKey.startsWith("errors.")
                ? t(errorKey)
                : errorKey}
            </p>
            <button type="button" className="btn-outline mt-3" onClick={() => void load()}>
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {!loading && !errorKey && items.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-[var(--wesal-border)] p-8 text-center text-sm text-[var(--wesal-muted)]">
            {t("admin.moderation.empty")}
          </p>
        ) : null}

        {!loading && !errorKey && items.length > 0 ? (
          <>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-[var(--wesal-muted)]">
                    <th className="px-3 py-2 text-start font-semibold">
                      {t("admin.moderation.columns.post")}
                    </th>
                    <th className="px-3 py-2 text-start font-semibold">
                      {t("admin.moderation.columns.owner")}
                    </th>
                    <th className="hidden px-3 py-2 text-start font-semibold md:table-cell">
                      {t("admin.moderation.columns.type")}
                    </th>
                    <th className="hidden px-3 py-2 text-start font-semibold lg:table-cell">
                      {t("admin.moderation.columns.date")}
                    </th>
                    <th className="px-3 py-2 text-start font-semibold">
                      {t("admin.moderation.columns.status")}
                    </th>
                    <th className="px-3 py-2 text-start font-semibold">
                      {t("admin.moderation.columns.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const badge = statusBadge(item);
                    const initial = (
                      item.ownerDisplayName.charAt(0) || "?"
                    ).toUpperCase();
                    return (
                      <tr
                        key={`${item.kind}-${item.id}`}
                        className="rounded-2xl bg-[color-mix(in_srgb,var(--wesal-pink-soft)_35%,white)]"
                        data-testid={`admin-moderation-row-${item.id}`}
                      >
                        <td className="rounded-s-2xl px-3 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <AdminModerationThumb
                              imagePath={item.images[0]?.url}
                              className="h-14 w-[4.5rem] shrink-0 rounded-xl object-cover"
                            />
                            <p className="line-clamp-2 max-w-[12rem] text-xs text-[var(--wesal-muted)] sm:max-w-[16rem]">
                              {item.content?.trim() ||
                                t("admin.moderation.noContent")}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-xs font-bold text-white">
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[var(--wesal-text)]">
                                {item.ownerDisplayName || "—"}
                              </p>
                              <p className="truncate text-xs text-[var(--wesal-muted)]">
                                {roleLabel(item.ownerRole)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-3 align-middle md:table-cell">
                          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--wesal-maroon-dark)] ring-1 ring-[var(--wesal-border)]">
                            {typeBadge(item)}
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 align-middle text-[var(--wesal-muted)] lg:table-cell">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                              aria-hidden="true"
                            />
                            {badge.label}
                          </span>
                        </td>
                        <td className="rounded-e-2xl px-3 py-3 align-middle">
                          <AdminActionToolbar
                            item={item}
                            disabled={busy !== null}
                            onAction={handleAction}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--wesal-muted)]">
                {t("admin.moderation.pagination.summary", {
                  count: items.length,
                  total: totalCount,
                })}
              </p>
              <nav
                className="flex items-center gap-1.5"
                aria-label={t("admin.moderation.pagination.label")}
              >
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)] disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
                      n === page
                        ? "bg-[var(--wesal-maroon)] text-white"
                        : "border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
                    }`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)] disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </nav>
            </div>
          </>
        ) : null}
      </section>

      <DeletePostModal
        open={Boolean(deleteTarget)}
        busy={busy === "delete"}
        errorKey={busy === "delete" || deleteTarget ? actionError : null}
        contentLabel={deleteTarget?.ownerDisplayName}
        onClose={() => {
          if (busy === "delete") return;
          setDeleteTarget(null);
          setActionError(null);
        }}
        onConfirm={(reason) => {
          void confirmDelete(reason);
        }}
      />

      <RestrictionModal
        open={Boolean(lockTarget)}
        busy={busy === "lock"}
        errorKey={busy === "lock" || lockTarget ? actionError : null}
        user={
          lockTarget
            ? {
                userId: lockTarget.ownerUserId,
                displayName: lockTarget.ownerDisplayName,
                roleLabel: roleLabel(lockTarget.ownerRole),
              }
            : null
        }
        onClose={() => {
          if (busy === "lock") return;
          setLockTarget(null);
          setActionError(null);
        }}
        onConfirm={(payload) => {
          void confirmLock(payload);
        }}
      />

      <UnlockAccountDialog
        open={Boolean(unlockTarget)}
        busy={busy === "unlock"}
        errorKey={busy === "unlock" || unlockTarget ? actionError : null}
        target={
          unlockTarget
            ? {
                userId: unlockTarget.ownerUserId,
                displayName: unlockTarget.ownerDisplayName,
                roleLabel: roleLabel(unlockTarget.ownerRole),
              }
            : null
        }
        onClose={() => {
          if (busy === "unlock") return;
          setUnlockTarget(null);
          setActionError(null);
        }}
        onConfirm={() => {
          void confirmUnlock();
        }}
      />

      <ModerationSuccessModal
        open={successVariant === "postDeleted"}
        variant="postDeleted"
        onClose={() => setSuccessVariant(null)}
      />

      <ModerationSuccessModal
        open={successVariant === "userRestricted"}
        variant="userRestricted"
        body={
          lockSuccess
            ? t("admin.moderation.restrict.successBodyNamed", {
                name: lockSuccess.name,
                period: lockSuccess.period,
              })
            : undefined
        }
        onClose={() => {
          setSuccessVariant(null);
          setLockSuccess(null);
        }}
      >
        {lockSuccess ? (
          <div className="space-y-3 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]/40 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-sm font-bold text-white">
                {(lockSuccess.name.charAt(0) || "?").toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{lockSuccess.name}</p>
                <p className="text-xs text-[var(--wesal-muted)]">
                  {lockSuccess.roleLabel}
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs font-semibold text-[var(--wesal-maroon-dark)]">
              <CalendarTiny />
              {t("admin.moderation.restrict.periodSummary", {
                period: lockSuccess.period,
              })}
            </p>
            <div>
              <p className="mb-2 text-xs font-bold text-[var(--wesal-text)]">
                {t("admin.moderation.restrict.whatRestricted")}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "admin.moderation.restrict.capability.access",
                    "admin.moderation.restrict.capability.publish",
                    "admin.moderation.restrict.capability.edit",
                    "admin.moderation.restrict.capability.offers",
                  ] as const
                ).map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-bold text-[#b42318] ring-1 ring-[#f5c6c2]"
                  >
                    ⌀ {t(key)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </ModerationSuccessModal>

      <SuccessToast
        open={Boolean(toast)}
        message={toast ?? ""}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarTiny() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
