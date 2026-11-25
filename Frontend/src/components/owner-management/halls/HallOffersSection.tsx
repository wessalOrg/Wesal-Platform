"use client";

import { useCallback, useState } from "react";
import ContentPagination from "@/components/ui/ContentPagination";
import { useContentPagination } from "@/hooks/useContentPagination";
import HallOfferForm from "@/components/owner-management/halls/HallOfferForm";
import { ApiError } from "@/lib/api-error";
import {
  canStopOffer,
  calculateOfferDiscountPercent,
  deriveOfferLifecycleStatus,
  type OfferLifecycleStatus,
} from "@/lib/offer-validation";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
import { useT } from "@/i18n";
import { fetchOwnerHallOffers, stopHallOffer } from "@/services/hall-offers";

type HallOffersSectionProps = {
  hallId: string;
};

function formatMoney(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

function formatWhen(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return iso;
  }
}

function lifecycleLabelKey(status: OfferLifecycleStatus): string {
  switch (status) {
    case "scheduled":
      return "owner.offers.status.scheduled";
    case "active":
      return "owner.offers.status.active";
    case "expired":
      return "owner.offers.status.expired";
    case "stopped":
      return "owner.offers.status.stopped";
  }
}

export default function HallOffersSection({ hallId }: HallOffersSectionProps) {
  const t = useT();
  const fetchPage = useCallback((page: number, size: number) => fetchOwnerHallOffers(hallId, page, size), [hallId]);
  const pagination = useContentPagination({ context: hallId, pageSize: 30, fetchPage, autoLoadAll: true });
  const items = pagination.items;
  const loading = !pagination.loaded && pagination.busy;
  const errorKey = pagination.error instanceof ApiError
    ? pagination.error.status === 401 ? "owner.offers.errors.unauthorized"
      : pagination.error.status === 403 ? "owner.offers.errors.forbidden"
      : pagination.error.status === 404 ? "owner.offers.errors.notFound" : "owner.offers.errors.loadFailed"
    : pagination.error ? "owner.offers.errors.loadFailed" : null;
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const locale =
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en-GB"
      : "ar-EG";

  const load = pagination.refresh;

  useOfferLifecycle(items, { revalidateAtBoundary: false, onRevalidate: () => load() });

  const onStop = async (offerId: string) => {
    if (stoppingId) return;
    setStoppingId(offerId);
    setStopError(null);
    try {
      await stopHallOffer(hallId, offerId);
      setConfirmId(null);
      setSuccess(t("owner.offers.stopSuccess"));
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStopError(t("owner.offers.errors.stopConflict"));
        await load();
      } else {
        setStopError(t("owner.offers.errors.stopFailed"));
      }
    } finally {
      setStoppingId(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="hall-offers-section" data-hall-id={hallId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-primary !min-h-11"
          data-testid="hall-offer-create-open"
          onClick={() => {
            setFormOpen(true);
            setSuccess(null);
          }}
        >
          {t("owner.offers.createAction")}
        </button>
        {success ? (
          <p className="text-sm font-medium text-[var(--wesal-maroon)]" role="status">
            {success}
          </p>
        ) : null}
      </div>

      {formOpen ? (
        <HallOfferForm
          hallId={hallId}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setSuccess(t("owner.offers.createSuccess"));
            void load();
          }}
        />
      ) : null}

      {loading ? (
        <div
          className="h-36 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--wesal-pink)_40%,white)]"
          aria-busy="true"
          data-testid="hall-offers-loading"
        />
      ) : errorKey && !pagination.loaded ? (
        <div className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 text-center">
          <p className="text-sm text-[var(--wesal-muted)]">{t(errorKey)}</p>
          <button type="button" className="btn-outline mt-3" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </div>
      ) : items.length === 0 && !pagination.busy ? (
        <p className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 text-sm text-[var(--wesal-muted)]">
          {t("owner.offers.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((offer) => {
            const status = deriveOfferLifecycleStatus({
              startsAt: offer.startsAt,
              endsAt: offer.endsAt,
              stoppedAt: offer.stoppedAt,
            });
            const discount = calculateOfferDiscountPercent(
              offer.oldBookingPrice,
              offer.offerPrice,
            );
            const stoppable = canStopOffer(status);
            return (
              <li
                key={offer.id}
                className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4"
                data-testid="hall-offer-card"
                data-offer-status={status}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1 text-start">
                    <p className="flex flex-wrap items-baseline gap-2 text-base">
                      <span className="font-bold text-[var(--wesal-maroon)]">
                        {formatMoney(offer.offerPrice, locale)}{" "}
                        {t("owner.offers.currency")}
                      </span>
                      <span className="text-sm text-[var(--wesal-muted)] line-through">
                        {formatMoney(offer.oldBookingPrice, locale)}{" "}
                        {t("owner.offers.currency")}
                      </span>
                      {discount != null ? (
                        <span className="text-xs font-semibold text-[var(--wesal-maroon)]">
                          {t("owner.offers.discountBadge", {
                            percent: String(discount),
                          })}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--wesal-muted)]">
                      {t("owner.offers.dateRange", {
                        start: formatWhen(offer.startsAt, locale),
                        end: formatWhen(offer.endsAt, locale),
                      })}
                    </p>
                  </div>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--wesal-maroon)]">
                    {t(lifecycleLabelKey(status))}
                  </span>
                </div>

                {stoppable && confirmId !== offer.id ? (
                  <button
                    type="button"
                    className="btn-outline !min-h-9 mt-3 px-3 text-sm"
                    data-testid="hall-offer-stop"
                    onClick={() => {
                      setConfirmId(offer.id);
                      setStopError(null);
                    }}
                  >
                    {t("owner.offers.stopAction")}
                  </button>
                ) : null}

                {stoppable && confirmId === offer.id ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_6%,white)] p-3">
                    <p className="text-xs leading-5 text-[var(--wesal-text)]">
                      {t("owner.offers.stopConfirmBody")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary !min-h-9 px-3 text-sm"
                        disabled={stoppingId === offer.id}
                        aria-busy={stoppingId === offer.id || undefined}
                        data-testid="hall-offer-stop-confirm"
                        onClick={() => void onStop(offer.id)}
                      >
                        {stoppingId === offer.id
                          ? t("owner.offers.stopping")
                          : t("owner.offers.stopConfirm")}
                      </button>
                      <button
                        type="button"
                        className="btn-outline !min-h-9 px-3 text-sm"
                        disabled={stoppingId === offer.id}
                        onClick={() => setConfirmId(null)}
                      >
                        {t("owner.offers.cancel")}
                      </button>
                    </div>
                    {stopError ? (
                      <p className="text-xs text-[#b42318]" role="alert">
                        {stopError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {pagination.loaded || !pagination.error ? <ContentPagination {...pagination}
        onMore={() => void pagination.loadMore()} onRetry={() => void pagination.refresh()} /> : null}
    </div>
  );
}
