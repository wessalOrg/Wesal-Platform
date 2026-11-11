"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import {
  formatOfferDateRange,
  isoToOfferDateInput,
  offerDateToIso,
} from "@/lib/offer-format";
import { offerDiscountPercent } from "@/lib/offer-status";
import type { HallOffer } from "@/types/offers";

export type HallOfferFormValues = {
  oldBookingPrice: string;
  offerPrice: string;
  startsAt: string;
  endsAt: string;
};

type HallOfferFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  hallName: string;
  hallImageUrl?: string | null;
  initial?: HallOffer | null;
  busy?: boolean;
  errorKey?: string | null;
  onClose: () => void;
  onSubmit: (values: HallOfferFormValues) => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function emptyValues(): HallOfferFormValues {
  return { oldBookingPrice: "", offerPrice: "", startsAt: "", endsAt: "" };
}

function fromOffer(offer: HallOffer): HallOfferFormValues {
  return {
    oldBookingPrice: String(offer.oldBookingPrice ?? ""),
    offerPrice: String(offer.offerPrice ?? ""),
    startsAt: isoToOfferDateInput(offer.startsAt),
    endsAt: isoToOfferDateInput(offer.endsAt),
  };
}

export function validateHallOfferForm(
  values: HallOfferFormValues,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  const oldPrice = Number(values.oldBookingPrice);
  const offerPrice = Number(values.offerPrice);
  if (!values.startsAt || !values.endsAt) return t("offers.validation.datesRequired");
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
    return t("offers.validation.oldPriceRequired");
  }
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    return t("offers.validation.offerPriceRequired");
  }
  if (offerPrice >= oldPrice) return t("offers.validation.offerBelowOld");
  const startIso = offerDateToIso(values.startsAt, false);
  const endIso = offerDateToIso(values.endsAt, true);
  if (!startIso || !endIso) return t("offers.validation.datesRequired");
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return t("offers.validation.endAfterStart");
  }
  return null;
}

export default function HallOfferFormModal({
  open,
  mode,
  hallName,
  hallImageUrl = null,
  initial = null,
  busy = false,
  errorKey = null,
  onClose,
  onSubmit,
}: HallOfferFormModalProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<HallOfferFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(initial ? fromOffer(initial) : emptyValues());
    setLocalError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled"),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
    };
  }, [open, busy, onClose]);

  const oldPriceNum = Number(values.oldBookingPrice);
  const offerPriceNum = Number(values.offerPrice);
  const discount = offerDiscountPercent(oldPriceNum, offerPriceNum);
  const dateLabel = formatOfferDateRange(
    offerDateToIso(values.startsAt, false) || null,
    offerDateToIso(values.endsAt, true) || null,
    locale,
  );

  const resolvedError = useMemo(() => {
    if (localError) return localError;
    if (!errorKey) return null;
    if (
      errorKey.startsWith("offers.") ||
      errorKey.startsWith("errors.") ||
      errorKey.startsWith("owner.")
    ) {
      return t(errorKey);
    }
    return errorKey;
  }, [errorKey, localError, t]);

  if (!open) return null;

  function patch(partial: Partial<HallOfferFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
    setLocalError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateHallOfferForm(values, t);
    if (error) {
      setLocalError(error);
      return;
    }
    onSubmit(values);
  }

  return (
    <div className="fixed inset-0 z-[140]" role="presentation" data-testid="hall-offer-form-modal">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)] backdrop-blur-[2px]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base font-extrabold text-[var(--wesal-maroon-dark)] sm:text-lg"
              >
                {mode === "edit" ? t("offers.hall.editTitle") : t("offers.hall.createTitle")}
              </h2>
              <p className="mt-1 text-xs text-[var(--wesal-muted)]">
                {t("offers.hall.createSubtitle")}
              </p>
            </div>
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)] hover:bg-white"
              aria-label={t("common.close")}
              disabled={busy}
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <form
            onSubmit={handleSubmit}
            className="grid max-h-[calc(92svh-4.5rem)] gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,17rem)] sm:p-5"
          >
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
                  {t("offers.hall.oldBookingPrice")}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="wesal-input w-full"
                  value={values.oldBookingPrice}
                  disabled={busy}
                  onChange={(event) => patch({ oldBookingPrice: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
                  {t("offers.hall.offerPrice")}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="wesal-input w-full text-[var(--wesal-maroon)]"
                  value={values.offerPrice}
                  disabled={busy}
                  onChange={(event) => patch({ offerPrice: event.target.value })}
                />
              </label>
              {discount != null ? (
                <p className="text-xs font-bold text-[var(--wesal-maroon)]">
                  {t("offers.discount", { percent: discount })}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
                    {t("offers.form.startsAt")}
                  </span>
                  <input
                    type="date"
                    className="wesal-input w-full"
                    value={values.startsAt}
                    disabled={busy}
                    onChange={(event) => patch({ startsAt: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
                    {t("offers.form.endsAt")}
                  </span>
                  <input
                    type="date"
                    className="wesal-input w-full"
                    value={values.endsAt}
                    disabled={busy}
                    onChange={(event) => patch({ endsAt: event.target.value })}
                  />
                </label>
              </div>
              {resolvedError ? (
                <p className="text-sm text-[#b42318]" role="alert">
                  {resolvedError}
                </p>
              ) : null}
            </div>

            <aside className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]">
              <div className="relative aspect-[4/3] bg-[var(--wesal-pink)]">
                {hallImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hallImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {discount != null ? (
                  <span className="absolute end-2 top-2 rounded-md bg-[var(--wesal-maroon)] px-2 py-1 text-[0.65rem] font-bold text-white">
                    {t("offers.discount", { percent: discount })}
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
                  {t("offers.hall.previewTitle", { name: hallName })}
                </p>
                <OfferPriceDisplay
                  oldPrice={Number.isFinite(oldPriceNum) ? oldPriceNum : null}
                  offerPrice={Number.isFinite(offerPriceNum) ? offerPriceNum : null}
                />
                {dateLabel ? (
                  <p className="text-[0.7rem] text-[var(--wesal-muted)]">{dateLabel}</p>
                ) : null}
              </div>
            </aside>

            <div className="sm:col-span-2">
              <p className="mb-3 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2 text-[0.7rem] text-[var(--wesal-maroon-dark)]">
                {t("offers.hall.visibleNote")}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-primary min-h-11 px-5" disabled={busy}>
                  {busy
                    ? t("offers.form.saving")
                    : mode === "edit"
                      ? t("offers.form.save")
                      : t("offers.hall.add")}
                </button>
                <button
                  type="button"
                  className="btn-outline min-h-11 px-5"
                  disabled={busy}
                  onClick={onClose}
                >
                  {t("offers.form.cancel")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
