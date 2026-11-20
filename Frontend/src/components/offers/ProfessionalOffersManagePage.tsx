"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProfessionalOfferForm, {
  type ProfessionalOfferFormValues,
} from "@/components/offers/ProfessionalOfferForm";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import StopOfferConfirmDialog from "@/components/offers/StopOfferConfirmDialog";
import PublishingRestrictionBanner from "@/components/moderation/PublishingRestrictionBanner";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAccountPublishingLock } from "@/hooks/useAccountPublishingLock";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatOfferDateRange } from "@/lib/offer-format";
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
import { professionalProfilePath } from "@/lib/account-profile-path";
import OfferManageIcon, { OfferBannerCamera } from "@/components/offers/OfferManageIcon";
import "./professional-offers-manage.css";

type StatusFilter = "all" | OfferLifecycleStatus;
type ViewMode = "list" | "create" | "edit";

export default function ProfessionalOffersManagePage() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const publishingLock = useAccountPublishingLock();
  const { canPublish, userId, statusLoading: approvalLoading } =
    useProfessionalAccountAccess();
  const canMutate = canPublish && !publishingLock.isLocked && !approvalLoading;
  const [offers, setOffers] = useState<ProfessionalOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<ProfessionalOffer | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stopTarget, setStopTarget] = useState<ProfessionalOffer | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorKey(null);
    try {
      const page = await fetchMyProfessionalOffers(1, 50);
      setOffers(page.items);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorKey(
        err instanceof ApiError ? err.message : "offers.errors.loadFailed",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () =>
      offers.map((offer) => ({
        offer,
        status: resolveOfferStatus(offer.startsAt, offer.endsAt, offer.stoppedAt),
      })),
    [offers],
  );

  const counts = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const scheduled = rows.filter((r) => r.status === "scheduled").length;
    const expired = rows.filter((r) => r.status === "expired").length;
    const stopped = rows.filter((r) => r.status === "stopped").length;
    return { total: rows.length, active, scheduled, expired, stopped };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  async function openEdit(offer: ProfessionalOffer) {
    setFormBusy(true);
    setFormError(null);
    try {
      const fresh = await fetchProfessionalOffer(offer.id);
      setEditing(fresh);
      setView("edit");
    } catch (err) {
      setErrorKey(
        err instanceof ApiError ? err.message : "offers.errors.loadFailed",
      );
    } finally {
      setFormBusy(false);
    }
  }

  async function handleSubmit(values: ProfessionalOfferFormValues) {
    if (!canPublish || approvalLoading) {
      setFormError("professionals.offers.errors.forbidden");
      return;
    }
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
      priceBox: values.includePrice
        ? Number(values.priceBox || values.offerPrice)
        : null,
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
    if (!stopTarget) return;
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
        <OfferBannerCamera />
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
          {errorKey?.startsWith("offers.") || errorKey?.startsWith("errors.")
            ? t(errorKey)
            : errorKey || t("offers.errors.loadFailed")}
        </p>
      ) : null}
      {status === "ready" && visible.length === 0 ? (
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
              const description = lines.slice(1).join(" ");
              const profileId = offer.ownerUserId || userId;
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
                    <div className="pro-offers-price">
                      <OfferManageIcon name="tag" />
                      <OfferPriceDisplay oldPrice={offer.oldPrice} offerPrice={offer.offerPrice} size="sm" />
                    </div>
                    <div className="pro-offers-meta">
                      <OfferStatusBadge status={offerStatus} />
                      <span>{formatOfferDateRange(offer.startsAt, offer.endsAt, locale)}</span>
                    </div>
                  </div>
                  <div className="pro-offers-actions">
                    {profileId ? (
                      <Link href={professionalProfilePath(profileId)} className="pro-offers-action"
                        aria-label={t("offers.card.viewProfile")} title={t("offers.card.viewProfile")}>
                        <OfferManageIcon name="view" />
                      </Link>
                    ) : null}
                    {lifecycleOpen ? (
                      <>
                        <button type="button" className="pro-offers-action" disabled={actionDisabled}
                          aria-label={t("offers.actions.edit")} title={actionHint || t("offers.actions.edit")}
                          onClick={() => { if (!actionDisabled) void openEdit(offer); }}>
                          <OfferManageIcon name="edit" />
                        </button>
                        <button type="button" className="pro-offers-action" disabled={actionDisabled}
                          aria-label={t("offers.actions.stop")} title={actionHint || t("offers.actions.stop")}
                          onClick={() => { if (!actionDisabled) { setStopError(null); setStopTarget(offer); } }}>
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
