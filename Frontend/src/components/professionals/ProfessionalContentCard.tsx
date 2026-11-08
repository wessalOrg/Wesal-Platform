"use client";

import { useState } from "react";
import { useT } from "@/i18n";
import {
  canStopOffer,
  deriveOfferLifecycleStatus,
  type OfferLifecycleStatus,
} from "@/lib/offer-validation";
import { resolveMediaUrl } from "@/lib/hall-media-url";
import type { ProfessionalProfileContentItem } from "@/types/professional-profile";

type ProfessionalContentCardProps = {
  item: ProfessionalProfileContentItem;
  kind: "post" | "offer";
  canEdit?: boolean;
  onEdit?: (item: ProfessionalProfileContentItem) => void;
  canStop?: boolean;
  onStop?: (item: ProfessionalProfileContentItem) => Promise<void> | void;
  showLifecycle?: boolean;
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

function formatWhen(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
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
      return "professionals.offers.status.scheduled";
    case "active":
      return "professionals.offers.status.active";
    case "expired":
      return "professionals.offers.status.expired";
    case "stopped":
      return "professionals.offers.status.stopped";
  }
}

export default function ProfessionalContentCard({
  item,
  kind,
  canEdit = false,
  onEdit,
  canStop = false,
  onStop,
  showLifecycle = false,
}: ProfessionalContentCardProps) {
  const t = useT();
  const cover = item.images[0]?.url ? resolveMediaUrl(item.images[0].url) : "";
  const locale =
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en-GB"
      : "ar-EG";
  const caption = item.content?.trim() || "";
  const offerPrice = item.offerPrice;
  const oldPrice = item.oldPrice;
  const price = item.price;
  const lifecycle =
    kind === "offer"
      ? deriveOfferLifecycleStatus({
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          stoppedAt: item.stoppedAt,
        })
      : null;
  const stoppable = Boolean(
    canStop && onStop && lifecycle && canStopOffer(lifecycle),
  );
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const onConfirmStop = async () => {
    if (!onStop || stopping) return;
    setStopping(true);
    setStopError(null);
    try {
      await onStop(item);
      setConfirmStop(false);
    } catch (error) {
      setStopError(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("professionals.offers.errors.stopFailed"),
      );
    } finally {
      setStopping(false);
    }
  };

  return (
    <article
      className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] bg-white shadow-[0_10px_28px_rgba(88,40,48,0.06)]"
      data-testid={`professional-${kind}-card`}
      data-offer-status={lifecycle ?? undefined}
    >
      <div className="relative aspect-[4/3] bg-[color-mix(in_srgb,var(--wesal-pink)_55%,white)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--wesal-muted)]">
            {kind === "offer"
              ? t("professionals.content.noOfferImage")
              : t("professionals.content.noPostImage")}
          </div>
        )}
        {showLifecycle && lifecycle ? (
          <span className="absolute start-2 top-2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {t(lifecycleLabelKey(lifecycle))}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3.5 text-start">
        {caption ? (
          <p className="line-clamp-3 text-sm leading-6 text-[var(--wesal-text)]">
            {caption}
          </p>
        ) : (
          <p className="text-sm text-[var(--wesal-muted)]">
            {kind === "offer"
              ? t("professionals.content.offerUntitled")
              : t("professionals.content.postUntitled")}
          </p>
        )}
        {kind === "offer" && (offerPrice != null || oldPrice != null) ? (
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            {offerPrice != null ? (
              <span className="font-bold text-[var(--wesal-maroon)]">
                {formatMoney(offerPrice, locale)} {t("professionals.content.currency")}
              </span>
            ) : null}
            {oldPrice != null ? (
              <span className="text-xs text-[var(--wesal-muted)] line-through">
                {formatMoney(oldPrice, locale)} {t("professionals.content.currency")}
              </span>
            ) : null}
          </p>
        ) : null}
        {kind === "offer" && (item.startsAt || item.endsAt) ? (
          <p className="text-xs leading-5 text-[var(--wesal-muted)]">
            {t("professionals.offers.dateRange", {
              start: formatWhen(item.startsAt, locale),
              end: formatWhen(item.endsAt, locale),
            })}
          </p>
        ) : null}
        {kind === "post" && price != null ? (
          <p className="text-sm font-semibold text-[var(--wesal-maroon)]">
            {formatMoney(price, locale)} {t("professionals.content.currency")}
          </p>
        ) : null}
        {kind === "post" && item.createdAt ? (
          <p className="text-xs text-[var(--wesal-muted)]">
            {formatWhen(item.createdAt, locale)}
          </p>
        ) : null}
        {canEdit && kind === "post" && onEdit ? (
          <button
            type="button"
            className="btn-outline !min-h-9 mt-1 w-full px-3 text-sm"
            data-testid="professional-post-edit"
            onClick={() => onEdit(item)}
          >
            {t("professionals.posts.editAction")}
          </button>
        ) : null}
        {stoppable && !confirmStop ? (
          <button
            type="button"
            className="btn-outline !min-h-9 mt-1 w-full px-3 text-sm"
            data-testid="professional-offer-stop"
            onClick={() => {
              setStopError(null);
              setConfirmStop(true);
            }}
          >
            {t("professionals.offers.stopAction")}
          </button>
        ) : null}
        {stoppable && confirmStop ? (
          <div
            className="mt-1 space-y-2 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_6%,white)] p-2.5"
            role="group"
            aria-label={t("professionals.offers.stopConfirmTitle")}
          >
            <p className="text-xs leading-5 text-[var(--wesal-text)]">
              {t("professionals.offers.stopConfirmBody")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary !min-h-9 flex-1 px-2 text-sm"
                disabled={stopping}
                aria-busy={stopping || undefined}
                data-testid="professional-offer-stop-confirm"
                onClick={() => void onConfirmStop()}
              >
                {stopping
                  ? t("professionals.offers.stopping")
                  : t("professionals.offers.stopConfirm")}
              </button>
              <button
                type="button"
                className="btn-outline !min-h-9 flex-1 px-2 text-sm"
                disabled={stopping}
                onClick={() => setConfirmStop(false)}
              >
                {t("professionals.offers.cancel")}
              </button>
            </div>
            {stopError ? (
              <p className="text-xs text-[#b42318]" role="alert">
                {stopError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
