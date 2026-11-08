"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSecureDocumentViewer from "@/components/admin/halls/AdminSecureDocumentViewer";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import {
  ADMIN_PHOTOGRAPHERS_PATH,
  adminPhotographerMessagesPath,
} from "@/lib/account-profile-path";
import {
  canApprovePhotographer,
  canRejectPhotographer,
  canRequestChangesPhotographer,
} from "@/lib/admin-photographers-mapper";
import {
  ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX,
  adminPhotographerRejectReasonMessageKey,
  validateAdminPhotographerRejectReason,
} from "@/lib/admin-reject-photographer";
import {
  ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX,
  adminPhotographerRequestChangesNotesMessageKey,
  validateAdminPhotographerRequestChangesNotes,
} from "@/lib/admin-request-changes-photographer";
import { ApiError } from "@/lib/api-error";
import { useT } from "@/i18n";
import {
  approveAdminPhotographerRequest,
  fetchAdminPhotographerRequestDetail,
  openAdminPhotographerConversation,
  rejectAdminPhotographerRequest,
  requestChangesAdminPhotographerRequest,
} from "@/services/admin-photographers";
import { fetchAdminPhotographerIdentityUrl } from "@/services/admin-documents";
import type { AdminPhotographerRequestDetail } from "@/types/admin-photographers";
import "../coordinators/admin-coordinators.css";

type AdminPhotographerRequestDetailViewProps = {
  userId: string;
};

type DetailTab = "basic" | "studio" | "identity";

function statusLabelKey(status: AdminPhotographerRequestDetail["approvalStatus"]): string {
  switch (status) {
    case "Approved":
      return "admin.photographers.filter.approved";
    case "Rejected":
      return "admin.photographers.filter.rejected";
    case "NeedsChanges":
      return "admin.photographers.filter.needsChanges";
    case "Pending":
    default:
      return "admin.photographers.filter.pending";
  }
}

function statusBadgeClass(
  status: AdminPhotographerRequestDetail["approvalStatus"],
): string {
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

function photographerTitle(detail: AdminPhotographerRequestDetail): string {
  if (detail.hasStudio) {
    return detail.studioName || detail.fullName || detail.email;
  }
  return detail.fullName || detail.email;
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

export default function AdminPhotographerRequestDetailView({
  userId,
}: AdminPhotographerRequestDetailViewProps) {
  const t = useT();
  const router = useRouter();
  const reasonId = useId();
  const notesId = useId();
  const [detail, setDetail] = useState<AdminPhotographerRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvePending, setApprovePending] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [changesPending, setChangesPending] = useState(false);
  const [contactPending, setContactPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonIssue, setReasonIssue] = useState<"required" | "tooLong" | null>(null);
  const [notes, setNotes] = useState("");
  const [notesIssue, setNotesIssue] = useState<"required" | "tooLong" | null>(null);
  const [tab, setTab] = useState<DetailTab>("basic");

  const busy = approvePending || rejectPending || changesPending;

  const locale = useMemo(() => {
    if (typeof document !== "undefined" && document.documentElement.lang === "en") {
      return "en-GB";
    }
    return "ar-EG";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await fetchAdminPhotographerRequestDetail(userId);
      setDetail(next);
    } catch (error) {
      setDetail(null);
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? "admin.photographers.detail.errors.notFound"
          : "admin.photographers.detail.errors.loadFailed",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const onApprove = async () => {
    if (!detail || busy) return;
    if (!canApprovePhotographer(detail.approvalStatus)) return;
    setApprovePending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await approveAdminPhotographerRequest(detail.userId);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setActionSuccess(t("admin.photographers.approve.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.photographers.approve.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.photographers.approve.errors.generic"));
      }
    } finally {
      setApprovePending(false);
    }
  };

  const onReject = async () => {
    if (!detail || busy) return;
    const issue = validateAdminPhotographerRejectReason(reason);
    setReasonIssue(issue);
    if (issue) return;
    setRejectPending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await rejectAdminPhotographerRequest(detail.userId, reason);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setReason("");
      setActionSuccess(t("admin.photographers.reject.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.photographers.reject.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.photographers.reject.errors.generic"));
      }
    } finally {
      setRejectPending(false);
    }
  };

  const onRequestChanges = async () => {
    if (!detail || busy) return;
    const issue = validateAdminPhotographerRequestChangesNotes(notes);
    setNotesIssue(issue);
    if (issue) return;
    setChangesPending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await requestChangesAdminPhotographerRequest(detail.userId, notes);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setNotes("");
      setActionSuccess(t("admin.photographers.requestChanges.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.photographers.requestChanges.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.photographers.requestChanges.errors.generic"));
      }
    } finally {
      setChangesPending(false);
    }
  };

  const onContact = async () => {
    if (!detail || contactPending) return;
    setContactPending(true);
    setActionError(null);
    try {
      const thread = await openAdminPhotographerConversation(detail.userId);
      router.push(
        adminPhotographerMessagesPath(thread.conversationId, photographerTitle(detail)),
      );
    } catch {
      setActionError(t("admin.photographers.contact.errors.generic"));
    } finally {
      setContactPending(false);
    }
  };

  if (loading) {
    return (
      <div
        className="admin-coord-card h-64 animate-pulse"
        aria-busy="true"
        data-testid="admin-photographer-detail-loading"
      />
    );
  }

  if (loadError || !detail) {
    return (
      <section className="admin-coord-card p-5" role="alert">
        <p className="text-sm text-[var(--wesal-muted)]">
          {t(loadError ?? "admin.photographers.detail.errors.loadFailed")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => void load()}>
            {t("common.retry")}
          </button>
          <Link href={ADMIN_PHOTOGRAPHERS_PATH} className="btn-outline">
            {t("admin.photographers.detail.back")}
          </Link>
        </div>
      </section>
    );
  }

  const reasonValidationText = reasonIssue
    ? t(adminPhotographerRejectReasonMessageKey(reasonIssue))
    : null;
  const notesValidationText = notesIssue
    ? t(adminPhotographerRequestChangesNotesMessageKey(notesIssue))
    : null;
  const canApprove = canApprovePhotographer(detail.approvalStatus);
  const canReject = canRejectPhotographer(detail.approvalStatus);
  const canChanges = canRequestChangesPhotographer(detail.approvalStatus);
  const typeLabel = t(
    detail.hasStudio
      ? "admin.photographers.type.studio"
      : "admin.photographers.type.independent",
  );

  return (
    <div className="seeker-home space-y-4" data-testid="admin-photographer-detail">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <p className="text-xs font-semibold text-[var(--wesal-muted)]">
            <Link href={ADMIN_PHOTOGRAPHERS_PATH} className="hover:underline">
              {t("admin.photographers.detail.back")}
            </Link>
          </p>
          <h1 className="seeker-welcome-title">
            {t("admin.photographers.queue.title")}
          </h1>
          <p className="seeker-welcome-body">
            {t("admin.photographers.queue.subtitle")}
          </p>
        </div>
      </section>

      <section className="admin-coord-card admin-coord-detail-card">
        <div className="admin-coord-detail-top">
          <div className="admin-coord-detail-identity">
            <span className="admin-coord-detail-avatar" aria-hidden="true">
              {(detail.fullName || photographerTitle(detail)).slice(0, 1)}
            </span>
            <div className="min-w-0 text-start">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-extrabold text-[var(--wesal-text)]">
                  {detail.fullName || photographerTitle(detail)}
                </h2>
                <span className={statusBadgeClass(detail.approvalStatus)}>
                  {t(statusLabelKey(detail.approvalStatus))}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--wesal-muted)]">
                {typeLabel}
                {" · "}
                {formatSubmittedAt(detail.submittedAt, locale)}
              </p>
            </div>
          </div>
        </div>

        {actionSuccess ? (
          <p className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]" role="status">
            {actionSuccess}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-3 text-sm font-medium text-[#b42318]" role="alert">
            {actionError}
          </p>
        ) : null}

        <div
          className="admin-coord-tabs"
          role="tablist"
          aria-label={t("admin.photographers.detail.tabsAria")}
        >
          {(
            [
              ["basic", "admin.photographers.detail.tabs.basic"],
              ["studio", "admin.photographers.detail.tabs.studio"],
              ["identity", "admin.photographers.detail.tabs.identity"],
            ] as const
          ).map(([id, labelKey]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`admin-coord-tab${active ? " admin-coord-tab--active" : ""}`}
                data-testid={`admin-photographer-tab-${id}`}
                onClick={() => setTab(id)}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        <div className="admin-photo-detail-layout">
          <div>
            {tab === "basic" ? (
              <section className="admin-coord-info-panel">
                <h3 className="admin-coord-info-title">
                  {t("admin.photographers.detail.account")}
                </h3>
                <dl className="admin-coord-info-list">
                  <InfoRow
                    label={t("admin.photographers.detail.fullName")}
                    value={detail.fullName || "—"}
                  />
                  <InfoRow
                    label={t("admin.photographers.detail.email")}
                    value={detail.email || "—"}
                  />
                  <InfoRow
                    label={t("admin.photographers.detail.userPhone")}
                    value={detail.userPhoneNumber || "—"}
                  />
                  <InfoRow
                    label={t("admin.photographers.detail.setupPhone")}
                    value={detail.setupPhoneNumber || "—"}
                  />
                  <InfoRow
                    label={t("admin.photographers.detail.submittedAt")}
                    value={formatSubmittedAt(detail.submittedAt, locale)}
                  />
                </dl>
              </section>
            ) : null}

            {tab === "studio" ? (
              <section className="admin-coord-info-panel">
                <h3 className="admin-coord-info-title">
                  {t("admin.photographers.detail.business")}
                </h3>
                <dl className="admin-coord-info-list">
                  <InfoRow
                    label={t("admin.photographers.detail.photographerType")}
                    value={typeLabel}
                  />
                  {detail.hasStudio ? (
                    <>
                      <InfoRow
                        label={t("admin.photographers.detail.studioName")}
                        value={detail.studioName || "—"}
                      />
                      <InfoRow
                        label={t("admin.photographers.detail.studioLocation")}
                        value={detail.studioLocation || "—"}
                      />
                      <InfoRow
                        label={t("admin.photographers.detail.detailedStudioLocation")}
                        value={detail.detailedStudioLocation || "—"}
                      />
                    </>
                  ) : (
                    <InfoRow
                      label={t("admin.photographers.detail.legalFullName")}
                      value={detail.legalFullName || "—"}
                    />
                  )}
                </dl>
                {!detail.hasStudio ? (
                  <p className="admin-photo-sensitive">
                    {t("admin.photographers.detail.legalNameHint")}
                  </p>
                ) : null}
              </section>
            ) : null}

            {tab === "identity" ? (
              <section className="admin-coord-identity-panel">
                <h3 className="admin-coord-info-title">
                  {t("admin.photographers.detail.identityTitle")}
                </h3>
                <p className="mb-3 text-xs text-[var(--wesal-muted)]">
                  {t("admin.photographers.detail.identityHint")}
                </p>
                <AdminSecureDocumentViewer
                  key={`${detail.userId}-identity`}
                  available={detail.hasIdentityDocument}
                  sourceKey={detail.hasIdentityDocument ? detail.userId : null}
                  labelKey="admin.photographers.detail.docs.identity"
                  altKey="admin.photographers.detail.docs.identityAlt"
                  hintKey="admin.photographers.detail.docs.open"
                  missingHintKey="admin.photographers.detail.docs.missing"
                  errorKey="admin.photographers.detail.docs.errors.loadFailed"
                  loadDocument={() => fetchAdminPhotographerIdentityUrl(detail.userId)}
                  testId="admin-photographer-identity"
                />
                <p className="admin-photo-sensitive">
                  {t("admin.photographers.detail.sensitiveHint")}
                </p>
              </section>
            ) : null}
          </div>

          <aside
            className="admin-photo-actions-panel"
            aria-label={t("admin.photographers.detail.actions")}
            data-testid="admin-photographer-actions"
          >
            {canApprove ? (
              <button
                type="button"
                className="btn-primary admin-photo-approve-btn !min-h-11"
                disabled={busy}
                aria-busy={approvePending || undefined}
                data-testid="admin-photographer-approve"
                onClick={() => void onApprove()}
              >
                {approvePending
                  ? t("admin.photographers.approve.submitting")
                  : t("admin.photographers.approve.submit")}
              </button>
            ) : null}

            {canReject ? (
              <div
                className="admin-photo-action-block"
                data-testid="admin-photographer-reject-dialog"
              >
                <button
                  type="button"
                  className="btn-outline admin-coord-reject-btn !min-h-11"
                  disabled={busy}
                  data-testid="admin-photographer-reject-confirm"
                  onClick={() => void onReject()}
                >
                  {rejectPending
                    ? t("admin.photographers.reject.submitting")
                    : t("admin.photographers.reject.submit")}
                </button>
                <label htmlFor={reasonId} className="admin-photo-action-label">
                  {t("admin.photographers.reject.reasonLabel")} *
                </label>
                <textarea
                  id={reasonId}
                  value={reason}
                  disabled={rejectPending}
                  maxLength={ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX + 20}
                  rows={3}
                  placeholder={t("admin.photographers.reject.reasonPlaceholder")}
                  className={`${hallFieldClassName(Boolean(reasonValidationText))} min-h-[4.5rem] w-full resize-y`}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonIssue(
                      validateAdminPhotographerRejectReason(event.target.value),
                    );
                  }}
                />
                {reasonValidationText ? (
                  <p className="text-xs text-[#b42318]" role="alert">
                    {reasonValidationText}
                  </p>
                ) : null}
              </div>
            ) : null}

            {canChanges ? (
              <div
                className="admin-photo-action-block"
                data-testid="admin-photographer-request-changes-dialog"
              >
                <button
                  type="button"
                  className="btn-outline admin-photo-changes-btn !min-h-11"
                  disabled={busy}
                  data-testid="admin-photographer-request-changes-confirm"
                  onClick={() => void onRequestChanges()}
                >
                  {changesPending
                    ? t("admin.photographers.requestChanges.submitting")
                    : t("admin.photographers.requestChanges.submit")}
                </button>
                <label htmlFor={notesId} className="admin-photo-action-label">
                  {t("admin.photographers.requestChanges.notesLabel")} *
                </label>
                <textarea
                  id={notesId}
                  value={notes}
                  disabled={changesPending}
                  maxLength={ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX + 20}
                  rows={3}
                  placeholder={t("admin.photographers.requestChanges.notesPlaceholder")}
                  className={`${hallFieldClassName(Boolean(notesValidationText))} min-h-[4.5rem] w-full resize-y`}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setNotesIssue(
                      validateAdminPhotographerRequestChangesNotes(event.target.value),
                    );
                  }}
                />
                {notesValidationText ? (
                  <p className="text-xs text-[#b42318]" role="alert">
                    {notesValidationText}
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="btn-outline !min-h-11"
              disabled={contactPending}
              aria-busy={contactPending || undefined}
              data-testid="admin-photographer-contact"
              onClick={() => void onContact()}
            >
              {contactPending
                ? t("admin.photographers.contact.opening")
                : t("admin.photographers.contact.submit")}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-coord-info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
