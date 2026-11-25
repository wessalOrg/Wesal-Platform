"use client";

import ContentPagination from "@/components/ui/ContentPagination";
import { useContentPagination } from "@/hooks/useContentPagination";
import { OfferDetailsDialog } from "@/components/offers/ProfessionalOfferDetails";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ProfessionalOfferForm, {
  type ProfessionalOfferFormValues,
} from "@/components/offers/ProfessionalOfferForm";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import StopOfferConfirmDialog from "@/components/offers/StopOfferConfirmDialog";
import PublishingRestrictionBanner from "@/components/moderation/PublishingRestrictionBanner";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import { useAccountPublishingLock } from "@/hooks/useAccountPublishingLock";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount } from "@/lib/authenticated-account";
import { createRequestScope } from "@/lib/request-scope";
import { isSameUserId } from "@/lib/current-user";
import OfferDateRange from "./OfferDateRange";
import { datetimeLocalToIso } from "@/lib/offer-validation";
import { resolveOfferStatus } from "@/lib/offer-status";
import {
  createProfessionalOffer,
  fetchMyProfessionalOffers,
  fetchProfessionalOffer,
  stopProfessionalOffer,
  updateProfessionalOffer,
} from "@/services/professional-offers";
import type { OfferLifecycleStatus, ProfessionalOffer } from "@/types/offers";
import OfferManageIcon from "@/components/offers/OfferManageIcon";
import "./professional-offers-manage.css";

type StatusFilter = "all" | OfferLifecycleStatus;
type ViewMode = "list" | "create" | "edit";
type EditLoadState = {
  scope: ReturnType<typeof createRequestScope>;
  offerId: string;
  pending: boolean;
  errorKey: string | null;
};

export default function ProfessionalOffersManagePage() {
  const t = useT();
  const publishingLock = useAccountPublishingLock();
  const { canPublish, userId, statusLoading: approvalLoading } =
    useProfessionalAccountAccess();
  const canMutate = canPublish && publishingLock.ready && !publishingLock.isLocked && !approvalLoading;
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const [preview, setPreview] = useState<{ account: typeof account; offerId: string } | null>(null);
  const editScope = useMemo(() => ({ account, userId, canMutate, ...createRequestScope() }), [account, userId, canMutate]);
  useLayoutEffect(() => {
    editScope.activate();
    return () => editScope.dispose();
  }, [editScope]);
  const [editLoad, setEditLoad] = useState<EditLoadState | null>(null);
  const editAction = editLoad?.scope === editScope ? editLoad : null;
  const pendingEdit = useRef<{ offerId: string; current: () => boolean } | null>(null);
  const fetchPage = useCallback((page: number, size: number) =>
    fetchMyProfessionalOffers(page, size), []);
  const pagination = useContentPagination({ context: userId ?? "",
    enabled: Boolean(userId), fetchPage, pageSize: 50, autoLoadAll: true });
  const offers = pagination.items;
  const status = pagination.loaded ? "ready" : pagination.error ? "error" : "loading";
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<ProfessionalOffer | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stopTarget, setStopTarget] = useState<ProfessionalOffer | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const load = pagination.refresh;

  useOfferLifecycle(offers, {
    revalidateAtBoundary: false,
    onRevalidate: () => load(),
  });

  const rows = offers.map((offer) => ({
    offer, status: resolveOfferStatus(offer.startsAt, offer.endsAt, offer.stoppedAt),
  }));

  const counts = (() => {
    const active = rows.filter((r) => r.status === "active").length;
    const scheduled = rows.filter((r) => r.status === "scheduled").length;
    const expired = rows.filter((r) => r.status === "expired").length;
    const stopped = rows.filter((r) => r.status === "stopped").length;
    return { total: pagination.total ?? "\u2026",
      active: pagination.complete ? active : "\u2026", scheduled: pagination.complete ? scheduled : "\u2026",
      expired: pagination.complete ? expired : "\u2026", stopped: pagination.complete ? stopped : "\u2026" };
  })();

  const visible = (() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  })();

  function cancelEditLoad() {
    editScope.latest("edit");
    pendingEdit.current = null;
    setEditLoad(null);
  }

  async function openEdit(offer: Pick<ProfessionalOffer, "id">) {
    if (!canMutate || formBusy || stopBusy || !editScope.isActive()) return;
    if (pendingEdit.current?.offerId === offer.id && pendingEdit.current.current()) return;
    const latest = editScope.latest("edit");
    const current = () => latest() && readAuthenticatedAccount() === account;
    const request = { offerId: offer.id, current };
    pendingEdit.current = request;
    setEditLoad({ scope: editScope, offerId: offer.id, pending: true, errorKey: null });
    setFormError(null);
    try {
      const fresh = await fetchProfessionalOffer(offer.id);
      if (!current()) return;
      if (fresh.id !== offer.id || (fresh.ownerUserId && !isSameUserId(fresh.ownerUserId, userId))) {
        throw new Error("Unexpected offer editing context");
      }
      setEditing(fresh);
      setView("edit");
      setEditLoad(null);
    } catch (err) {
      if (!current()) return;
      setEditLoad({ scope: editScope, offerId: offer.id, pending: false,
        errorKey: err instanceof ApiError && err.status === 404
          ? "offers.errors.editNotFound" : "offers.errors.editLoadFailed" });
    } finally {
      if (pendingEdit.current === request) pendingEdit.current = null;
    }
  }

  async function handleSubmit(values: ProfessionalOfferFormValues) {
    if (!editScope.isActive() || readAuthenticatedAccount() !== account) return;
    if (!canPublish || approvalLoading) {
      setFormError("professionals.offers.errors.forbidden");
      return;
    }
    if (!publishingLock.ready) return;
    if (publishingLock.isLocked) {
      setFormError("moderation.restriction.blocked");
      return;
    }
    setFormBusy(true);
    setFormError(null);
    const base = {
      content: values.content.trim() || null,
      oldPrice: Number(values.oldPrice),
      offerPrice: Number(values.offerPrice),
      startsAt: datetimeLocalToIso(values.startsAt) ?? "",
      endsAt: datetimeLocalToIso(values.endsAt) ?? "",
      images: values.newFiles,
    };
    try {
      if (view === "edit" && editing) {
        await updateProfessionalOffer(editing.id, {
          ...base,
          replaceImages: values.replaceImages || values.newFiles.length > 0,
          keepImageIds: values.existingImages.map((img) => img.id),
        });
      } else {
        await createProfessionalOffer(base);
      }
      setView("list");
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "offers.errors.saveFailed",
      );
    } finally {
      setFormBusy(false);
    }
  }

  async function handleStop() {
    if (!stopTarget || !editScope.isActive() || readAuthenticatedAccount() !== account) return;
    setStopBusy(true);
    setStopError(null);
    try {
      await stopProfessionalOffer(stopTarget.id);
      setStopTarget(null);
      if (view === "edit") {
        setView("list");
        setEditing(null);
      }
      await load();
    } catch (err) {
      setStopError(
        err instanceof ApiError ? err.message : "offers.errors.stopFailed",
      );
    } finally {
      setStopBusy(false);
    }
  }

  if (view === "create" || view === "edit") {
    return (
      <div className="space-y-4" data-testid="professional-offers-form-page">
        <header className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_12%,white),var(--wesal-pink-soft))] p-4">
          <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)]">
            {view === "edit" ? t("offers.pro.editTitle") : t("offers.pro.createTitle")}
          </h1>
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("offers.pro.formSubtitle")}
          </p>
        </header>
        {publishingLock.isLocked ? (
          <PublishingRestrictionBanner lockedUntil={publishingLock.lockedUntil} />
        ) : null}
        <ProfessionalOfferForm
          mode={view === "edit" ? "edit" : "create"}
          initial={editing}
          busy={formBusy || !canMutate}
          errorKey={formError}
          onCancel={() => {
            setView("list");
            setEditing(null);
          }}
          onRequestStop={
            view === "edit" && editing && canMutate
              ? () => {
                  setStopError(null);
                  setStopTarget(editing);
                }
              : undefined
          }
          onSubmit={(values) => {
            void handleSubmit(values);
          }}
        />
        <StopOfferConfirmDialog
          open={Boolean(stopTarget)}
          busy={stopBusy}
          errorKey={stopError}
          onClose={() => {
            if (!stopBusy) setStopTarget(null);
          }}
          onConfirm={() => {
            void handleStop();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5" data-testid="professional-offers-page">
      <header className="pro-offers-hero">
        <div className="pro-offers-hero-content">
          <div className="pro-offers-hero-copy">
            <h1><OfferManageIcon name="tag" />
              {t("offers.pro.title")}
            </h1>
            <p className="pro-offers-hero-subtitle">
              {t("offers.pro.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="pro-offers-create"
            disabled={!canMutate}
            title={
              publishingLock.isLocked
                ? t("moderation.restriction.blocked")
                : !canPublish
                  ? t("professionals.offers.errors.forbidden")
                  : undefined
            }
            onClick={() => {
              if (!canMutate) return;
              cancelEditLoad();
              setEditing(null);
              setFormError(null);
              setView("create");
            }}
            data-testid="pro-offers-add"
          >
            <span aria-hidden="true">+</span> {t("offers.pro.add")}
          </button>
        </div>
      </header>
      {publishingLock.isLocked ? (
        <PublishingRestrictionBanner lockedUntil={publishingLock.lockedUntil} />
      ) : null}

      <div className="pro-offers-filters" role="group" aria-label={t("offers.pro.title")}>
        {(
          [
            ["all", counts.total],
            ["active", counts.active],
            ["scheduled", counts.scheduled],
            ["expired", counts.expired],
            ["stopped", counts.stopped],
          ] as const
        ).map(([key, count]) => (
          <button
            key={key}
            type="button"
            className={`pro-offers-filter${filter === key ? " is-active" : ""}`}
            aria-pressed={filter === key}
            data-testid={`pro-offers-filter-${key}`}
            onClick={() => setFilter(key)}
          >
            <OfferManageIcon name={key} />
            {t(`offers.filter.${key}`)} <span>({count})</span>
          </button>
        ))}
      </div>

      {status === "loading" ? (
        <p className="text-sm text-[var(--wesal-muted)]">{t("offers.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {t("offers.errors.loadFailed")}
        </p>
      ) : null}
      {editAction?.pending ? (
        <p role="status" className="text-sm text-[var(--wesal-muted)]">{t("offers.pro.loadingEditor")}</p>
      ) : editAction?.errorKey ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 text-sm text-[var(--wesal-maroon-dark)]">
          <p>{t(editAction.errorKey)}</p>
          <button type="button" className="btn-outline !min-h-10" disabled={!canMutate || formBusy || stopBusy}
            onClick={() => { void openEdit({ id: editAction.offerId }); }}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      {status === "ready" && !pagination.busy && !pagination.error && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white p-6 text-center text-sm text-[var(--wesal-muted)]">
          {t("offers.pro.empty")}
        </p>
      ) : null}

      {status === "ready" && visible.length > 0 ? (
        <section className="pro-offers-list" aria-label={t("offers.table.offer")}>
          <div className="pro-offers-list-heading">{t("offers.table.offer")}</div>
          <ul>
            {visible.map(({ offer, status: offerStatus }) => {
              const lifecycleOpen = offerStatus === "active" || offerStatus === "scheduled";
              const lines = offer.content?.trim().split(/\r?\n/) ?? [];
              const title = lines[0] || t("offers.card.untitled");
              const description = lines.slice(1).join("\n");
              const actionDisabled = !canMutate || formBusy;
              const actionHint = publishingLock.isLocked
                ? t("moderation.restriction.blocked")
                : !canPublish ? t("professionals.offers.errors.forbidden") : undefined;
              return (
                <li className="pro-offers-row" key={offer.id} data-testid={"pro-offer-row-" + offer.id}>
                  <div className="pro-offers-image">
                    <AuthenticatedApiImage src={offer.images[0]?.url} alt="" className="h-full w-full object-cover"
                      fallback={<OfferManageIcon name="tag" />} />
                  </div>
                  <div className="pro-offers-details">
                    <h2>{title}</h2>
                    {description ? <p className="pro-offers-description">{description}</p> : null}
                    <div className="pro-offers-price-line">
                      <div className="pro-offers-price">
                        <OfferManageIcon name="tag" />
                        <OfferPriceDisplay oldPrice={offer.oldPrice} offerPrice={offer.offerPrice} size="sm" />
                      </div>
                      <OfferStatusBadge status={offerStatus} />
                    </div>
                    <div className="pro-offers-meta">
                      <OfferDateRange startsAt={offer.startsAt} endsAt={offer.endsAt} />
                    </div>
                  </div>
                  <div className="pro-offers-actions">
                    <button type="button" className="pro-offers-action"
                      aria-label={t("offers.card.viewDetails")} title={t("offers.card.viewDetails")}
                      onClick={() => { cancelEditLoad(); setPreview({ account, offerId: offer.id }); }}>
                      <OfferManageIcon name="view" />
                    </button>
                    {lifecycleOpen ? (
                      <>
                        <button type="button" className="pro-offers-action"
                          disabled={actionDisabled || (editAction?.pending && editAction.offerId === offer.id)}
                          aria-busy={editAction?.pending && editAction.offerId === offer.id}
                          aria-label={t("offers.actions.edit")} title={actionHint || t("offers.actions.edit")}
                          onClick={() => { if (!actionDisabled) void openEdit(offer); }}>
                          <OfferManageIcon name="edit" />
                        </button>
                        <button type="button" className="pro-offers-action" disabled={actionDisabled}
                          aria-label={t("offers.actions.stop")} title={actionHint || t("offers.actions.stop")}
                          onClick={() => { if (!actionDisabled) { cancelEditLoad(); setStopError(null); setStopTarget(offer); } }}>
                          <OfferManageIcon name="more" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ContentPagination {...pagination} onMore={() => void pagination.loadMore()}
        onRetry={() => void pagination.refresh()} />
      {account && preview?.account === account ? (
        <OfferDetailsDialog key={preview.offerId} offerId={preview.offerId}
          managementPreview onClose={() => setPreview(null)} />
      ) : null}
      <StopOfferConfirmDialog
        open={Boolean(stopTarget)}
        busy={stopBusy}
        errorKey={stopError}
        onClose={() => {
          if (!stopBusy) setStopTarget(null);
        }}
        onConfirm={() => {
          void handleStop();
        }}
      />
    </div>
  );
}
