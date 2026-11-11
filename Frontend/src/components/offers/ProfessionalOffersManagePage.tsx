"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProfessionalOfferForm, {
  type ProfessionalOfferFormValues,
} from "@/components/offers/ProfessionalOfferForm";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import StopOfferConfirmDialog from "@/components/offers/StopOfferConfirmDialog";
import PublishingRestrictionBanner from "@/components/moderation/PublishingRestrictionBanner";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAccountPublishingLock } from "@/hooks/useAccountPublishingLock";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatOfferDateRange, offerDateToIso } from "@/lib/offer-format";
import { resolveOfferStatus } from "@/lib/offer-status";
import {
  createProfessionalOffer,
  fetchMyProfessionalOffers,
  fetchProfessionalOffer,
  stopProfessionalOffer,
  updateProfessionalOffer,
} from "@/services/professional-offers";
import type { OfferLifecycleStatus, ProfessionalOffer } from "@/types/offers";

type StatusFilter = "all" | OfferLifecycleStatus;
type ViewMode = "list" | "create" | "edit";

export default function ProfessionalOffersManagePage() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const publishingLock = useAccountPublishingLock();
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
      startsAt: offerDateToIso(values.startsAt, false),
      endsAt: offerDateToIso(values.endsAt, true),
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
          busy={formBusy || publishingLock.isLocked}
          errorKey={formError}
          onCancel={() => {
            setView("list");
            setEditing(null);
          }}
          onRequestStop={
            view === "edit" && editing && !publishingLock.isLocked
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
      <header className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_12%,white),var(--wesal-pink-soft))] p-3.5 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-[var(--wesal-maroon-dark)] sm:text-xl">
              {t("offers.pro.title")}
            </h1>
            <p className="mt-1 text-[0.7rem] text-[var(--wesal-muted)] sm:text-xs">
              {t("offers.pro.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary min-h-10 shrink-0 px-3 text-sm sm:min-h-10 sm:px-4 sm:text-base disabled:cursor-not-allowed disabled:opacity-55"
            disabled={publishingLock.isLocked}
            title={
              publishingLock.isLocked
                ? t("moderation.restriction.blocked")
                : undefined
            }
            onClick={() => {
              if (publishingLock.isLocked) return;
              setEditing(null);
              setFormError(null);
              setView("create");
            }}
            data-testid="pro-offers-add"
          >
            + {t("offers.pro.add")}
          </button>
        </div>
      </header>
      {publishingLock.isLocked ? (
        <PublishingRestrictionBanner lockedUntil={publishingLock.lockedUntil} />
      ) : null}

      <div className="-mx-0.5 flex flex-nowrap gap-1.5 overflow-x-auto px-0.5 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
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
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[0.7rem] font-bold transition sm:px-3 sm:text-xs ${
              filter === key
                ? "bg-[var(--wesal-maroon)] text-white"
                : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)]"
            }`}
            onClick={() => setFilter(key)}
          >
            {t(`offers.filter.${key}`)} ({count})
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

      {/* Mobile: compact cards (no horizontal table scroll). */}
      <ul className="grid gap-2.5 md:hidden">
        {visible.map(({ offer, status: offerStatus }) => {
          const canManage =
            offerStatus === "active" || offerStatus === "scheduled";
          return (
            <li
              key={offer.id}
              className="rounded-xl border border-[var(--wesal-border)] bg-white p-3"
              data-testid={`pro-offer-card-${offer.id}`}
            >
              <div className="flex gap-2.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wesal-pink)]">
                  {offer.images[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offer.images[0].url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <p className="text-sm font-bold leading-snug text-[var(--wesal-maroon-dark)] [overflow-wrap:anywhere]">
                      {offer.content?.trim() || t("offers.card.untitled")}
                    </p>
                    <OfferStatusBadge status={offerStatus} />
                  </div>
                  <OfferPriceDisplay
                    oldPrice={offer.oldPrice}
                    offerPrice={offer.offerPrice}
                    size="sm"
                  />
                  <p className="text-[0.7rem] text-[var(--wesal-muted)]">
                    {formatOfferDateRange(offer.startsAt, offer.endsAt, locale)}
                  </p>
                </div>
              </div>
              {canManage ? (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    className="btn-outline min-h-9 flex-1 px-2 text-xs disabled:opacity-50"
                    disabled={publishingLock.isLocked}
                    title={
                      publishingLock.isLocked
                        ? t("moderation.restriction.blocked")
                        : undefined
                    }
                    onClick={() => {
                      if (publishingLock.isLocked) return;
                      void openEdit(offer);
                    }}
                  >
                    {t("offers.actions.edit")}
                  </button>
                  <button
                    type="button"
                    className="min-h-9 flex-1 rounded-lg border border-[var(--wesal-maroon)] px-2 text-xs font-bold text-[var(--wesal-maroon)] disabled:opacity-50"
                    disabled={publishingLock.isLocked}
                    title={
                      publishingLock.isLocked
                        ? t("moderation.restriction.blocked")
                        : undefined
                    }
                    onClick={() => {
                      if (publishingLock.isLocked) return;
                      setStopError(null);
                      setStopTarget(offer);
                    }}
                  >
                    {t("offers.actions.stop")}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Desktop/tablet: original table. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--wesal-border)] bg-white md:block">
        <table className="min-w-full text-start text-sm">
          <thead className="bg-[var(--wesal-pink-soft)] text-xs text-[var(--wesal-muted)]">
            <tr>
              <th className="px-3 py-3 font-bold">{t("offers.table.offer")}</th>
              <th className="px-3 py-3 font-bold">{t("offers.table.price")}</th>
              <th className="px-3 py-3 font-bold">{t("offers.table.duration")}</th>
              <th className="px-3 py-3 font-bold">{t("offers.table.status")}</th>
              <th className="px-3 py-3 font-bold">{t("offers.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ offer, status: offerStatus }) => {
              const canManage =
                offerStatus === "active" || offerStatus === "scheduled";
              return (
                <tr
                  key={offer.id}
                  className="border-t border-[var(--wesal-border)]"
                  data-testid={`pro-offer-row-${offer.id}`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wesal-pink)]">
                        {offer.images[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={offer.images[0].url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--wesal-maroon-dark)]">
                          {offer.content?.trim() || t("offers.card.untitled")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <OfferPriceDisplay
                      oldPrice={offer.oldPrice}
                      offerPrice={offer.offerPrice}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--wesal-muted)]">
                    {formatOfferDateRange(offer.startsAt, offer.endsAt, locale)}
                  </td>
                  <td className="px-3 py-3">
                    <OfferStatusBadge status={offerStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canManage ? (
                        <button
                          type="button"
                          className="btn-outline min-h-8 px-2 text-xs disabled:opacity-50"
                          disabled={publishingLock.isLocked}
                          title={
                            publishingLock.isLocked
                              ? t("moderation.restriction.blocked")
                              : undefined
                          }
                          onClick={() => {
                            if (publishingLock.isLocked) return;
                            void openEdit(offer);
                          }}
                        >
                          {t("offers.actions.edit")}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          className="min-h-8 rounded-lg border border-[var(--wesal-maroon)] px-2 text-xs font-bold text-[var(--wesal-maroon)] disabled:opacity-50"
                          disabled={publishingLock.isLocked}
                          title={
                            publishingLock.isLocked
                              ? t("moderation.restriction.blocked")
                              : undefined
                          }
                          onClick={() => {
                            if (publishingLock.isLocked) return;
                            setStopError(null);
                            setStopTarget(offer);
                          }}
                        >
                          {t("offers.actions.stop")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
