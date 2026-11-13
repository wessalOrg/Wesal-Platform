"use client";

import { useMemo, useState, type FormEvent } from "react";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import ConsultDateField from "@/components/home/ConsultDateField";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { useT } from "@/i18n";
import {
  formatOfferDateRange,
  isoToOfferDateInput,
  offerDateToIso,
  resolveOfferMediaUrl,
} from "@/lib/offer-format";
import { offerDiscountPercent, resolveOfferStatus } from "@/lib/offer-status";
import type { ProfessionalOffer } from "@/types/offers";

const TITLE_MAX = 150;
const MAX_IMAGES = 5;

export type ProfessionalOfferFormValues = {
  content: string;
  oldPrice: string;
  offerPrice: string;
  includePrice: boolean;
  priceBox: string;
  startsAt: string;
  endsAt: string;
  existingImages: Array<{ id: string; url: string }>;
  newFiles: File[];
  replaceImages: boolean;
};

type ProfessionalOfferFormProps = {
  mode: "create" | "edit";
  initial?: ProfessionalOffer | null;
  busy?: boolean;
  errorKey?: string | null;
  onSubmit: (values: ProfessionalOfferFormValues) => void;
  onCancel: () => void;
  onRequestStop?: () => void;
};

function emptyValues(): ProfessionalOfferFormValues {
  return {
    content: "",
    oldPrice: "",
    offerPrice: "",
    includePrice: true,
    priceBox: "",
    startsAt: "",
    endsAt: "",
    existingImages: [],
    newFiles: [],
    replaceImages: false,
  };
}

function fromOffer(offer: ProfessionalOffer): ProfessionalOfferFormValues {
  return {
    content: offer.content ?? "",
    oldPrice: String(offer.oldPrice ?? ""),
    offerPrice: String(offer.offerPrice ?? ""),
    includePrice: offer.priceBox != null,
    priceBox: offer.priceBox != null ? String(offer.priceBox) : "",
    startsAt: isoToOfferDateInput(offer.startsAt),
    endsAt: isoToOfferDateInput(offer.endsAt),
    existingImages: offer.images.map((img) => ({
      id: img.id,
      url: resolveOfferMediaUrl(img.url),
    })),
    newFiles: [],
    replaceImages: false,
  };
}

export function validateProfessionalOfferForm(
  values: ProfessionalOfferFormValues,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  const oldPrice = Number(values.oldPrice);
  const offerPrice = Number(values.offerPrice);
  const totalImages = values.existingImages.length + values.newFiles.length;
  const hasText = values.content.trim().length > 0;
  // 10.1 — image or plain-text post (at least one required).
  if (!hasText && totalImages === 0) {
    return t("offers.validation.contentOrImage");
  }
  if (!values.startsAt || !values.endsAt) return t("offers.validation.datesRequired");
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
    return t("offers.validation.oldPriceRequired");
  }
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    return t("offers.validation.offerPriceRequired");
  }
  if (offerPrice >= oldPrice) return t("offers.validation.offerBelowOld");
  if (values.includePrice) {
    const box = Number(values.priceBox);
    if (values.priceBox.trim() && (!Number.isFinite(box) || box < 0)) {
      return t("offers.validation.priceBoxInvalid");
    }
  }
  const startIso = offerDateToIso(values.startsAt, false);
  const endIso = offerDateToIso(values.endsAt, true);
  if (!startIso || !endIso) return t("offers.validation.datesRequired");
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return t("offers.validation.endAfterStart");
  }
  if (values.content.length > TITLE_MAX) {
    return t("offers.validation.titleMax", { count: TITLE_MAX });
  }
  if (totalImages > MAX_IMAGES) {
    return t("offers.validation.imagesMax", { count: MAX_IMAGES });
  }
  return null;
}

export default function ProfessionalOfferForm({
  mode,
  initial = null,
  busy = false,
  errorKey = null,
  onSubmit,
  onCancel,
  onRequestStop,
}: ProfessionalOfferFormProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [values, setValues] = useState<ProfessionalOfferFormValues>(() =>
    initial ? fromOffer(initial) : emptyValues(),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const oldPriceNum = Number(values.oldPrice);
  const offerPriceNum = Number(values.offerPrice);
  const discount = offerDiscountPercent(oldPriceNum, offerPriceNum);
  const previewStatus = resolveOfferStatus(
    offerDateToIso(values.startsAt, false) || null,
    offerDateToIso(values.endsAt, true) || null,
    initial?.stoppedAt ?? null,
  );
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
      errorKey.startsWith("owner.") ||
      errorKey.startsWith("moderation.")
    ) {
      return t(errorKey);
    }
    return errorKey;
  }, [errorKey, localError, t]);

  function patch(partial: Partial<ProfessionalOfferFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
    setLocalError(null);
  }

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...values.newFiles, ...Array.from(files)].slice(
      0,
      Math.max(0, MAX_IMAGES - values.existingImages.length),
    );
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls(next.map((file) => URL.createObjectURL(file)));
    patch({ newFiles: next, replaceImages: mode === "edit" });
  }

  function removeExisting(id: string) {
    patch({
      existingImages: values.existingImages.filter((img) => img.id !== id),
      replaceImages: true,
    });
  }

  function removeNew(index: number) {
    const next = values.newFiles.filter((_, i) => i !== index);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls(next.map((file) => URL.createObjectURL(file)));
    patch({ newFiles: next, replaceImages: mode === "edit" });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateProfessionalOfferForm(values, t);
    if (error) {
      setLocalError(error);
      return;
    }
    onSubmit(values);
  }

  const previewImage =
    previewUrls[0] ||
    values.existingImages[0]?.url ||
    "";

  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]"
      data-testid="professional-offer-form"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-sm sm:p-5"
      >
        <h2 className="text-base font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("offers.form.details")}
        </h2>

        <div>
          <p className="mb-2 text-sm font-bold text-[var(--wesal-maroon-dark)]">
            {t("offers.form.images")}
          </p>
          <div className="flex flex-wrap gap-2">
            {values.existingImages.map((img) => (
              <div
                key={img.id}
                className="relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--wesal-border)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute end-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label={t("offers.form.removeImage")}
                  onClick={() => removeExisting(img.id)}
                  disabled={busy}
                >
                  ×
                </button>
              </div>
            ))}
            {previewUrls.map((url, index) => (
              <div
                key={url}
                className="relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--wesal-border)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute end-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label={t("offers.form.removeImage")}
                  onClick={() => removeNew(index)}
                  disabled={busy}
                >
                  ×
                </button>
              </div>
            ))}
            {values.existingImages.length + values.newFiles.length < MAX_IMAGES ? (
              <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--wesal-maroon)]/40 bg-[var(--wesal-pink-soft)] text-center text-[0.65rem] font-bold text-[var(--wesal-maroon)]">
                <span>{t("offers.form.addImages")}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    onPickFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="mt-1.5 text-[0.7rem] text-[var(--wesal-muted)]">
            {t("offers.form.imagesHint", { count: MAX_IMAGES })}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-[var(--wesal-maroon-dark)]">
            <span>{t("offers.form.title")}</span>
            <span className="text-[0.7rem] font-medium text-[var(--wesal-muted)]">
              {values.content.length}/{TITLE_MAX}
            </span>
          </span>
          <input
            type="text"
            className={hallFieldClassName(false)}
            maxLength={TITLE_MAX}
            value={values.content}
            disabled={busy}
            onChange={(event) => patch({ content: event.target.value })}
            placeholder={t("offers.form.titlePlaceholder")}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              {t("offers.form.oldPrice")}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={hallFieldClassName(false)}
              value={values.oldPrice}
              disabled={busy}
              onChange={(event) => patch({ oldPrice: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              {t("offers.form.offerPrice")}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${hallFieldClassName(false)} text-[var(--wesal-maroon)]`}
              value={values.offerPrice}
              disabled={busy}
              onChange={(event) => patch({ offerPrice: event.target.value })}
            />
          </label>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-3 py-2.5">
          <span className="text-sm font-bold text-[var(--wesal-maroon-dark)]">
            {t("offers.form.addPriceBox")}
          </span>
          <input
            type="checkbox"
            className="wesal-checkbox"
            checked={values.includePrice}
            disabled={busy}
            onChange={(event) =>
              patch({
                includePrice: event.target.checked,
                priceBox: event.target.checked
                  ? values.priceBox || values.offerPrice
                  : "",
              })
            }
          />
        </label>

        {values.includePrice ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              {t("offers.form.priceBox")}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={hallFieldClassName(false)}
              value={values.priceBox}
              disabled={busy}
              placeholder={t("offers.form.priceBoxPlaceholder")}
              onChange={(event) => patch({ priceBox: event.target.value })}
              data-testid="offer-price-box"
            />
            <p className="mt-1 text-[0.7rem] text-[var(--wesal-muted)]">
              {t("offers.form.priceBoxHint")}
            </p>
          </label>
        ) : null}

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
            <ConsultDateField
              value={values.startsAt}
              disabled={busy}
              triggerClassName={hallFieldClassName(false)}
              onChange={(next) => patch({ startsAt: next })}
              testId="pro-offer-starts-at"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              {t("offers.form.endsAt")}
            </span>
            <ConsultDateField
              value={values.endsAt}
              disabled={busy}
              triggerClassName={hallFieldClassName(false)}
              onChange={(next) => patch({ endsAt: next })}
              testId="pro-offer-ends-at"
            />
          </label>
        </div>

        {resolvedError ? (
          <p className="text-sm text-[#b42318]" role="alert">
            {resolvedError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-1">
          <button type="submit" className="btn-primary min-h-11 px-5" disabled={busy}>
            {busy
              ? t("offers.form.saving")
              : mode === "edit"
                ? t("offers.form.save")
                : t("offers.form.publish")}
          </button>
          <button
            type="button"
            className="btn-outline min-h-11 px-5"
            disabled={busy}
            onClick={onCancel}
          >
            {t("offers.form.cancel")}
          </button>
          {mode === "edit" && onRequestStop && previewStatus !== "stopped" && previewStatus !== "expired" ? (
            <button
              type="button"
              className="min-h-11 rounded-xl border border-[var(--wesal-maroon)] bg-white px-5 text-sm font-bold text-[var(--wesal-maroon)]"
              disabled={busy}
              onClick={onRequestStop}
            >
              {t("offers.form.stop")}
            </button>
          ) : null}
        </div>
      </form>

      <aside className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-sm">
          <div className="relative aspect-[4/3] bg-[var(--wesal-pink)]">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--wesal-muted)]">
                {t("offers.card.noImage")}
              </div>
            )}
            <span className="absolute end-3 top-3 rounded-md bg-[var(--wesal-maroon)] px-2 py-1 text-[0.65rem] font-bold text-white">
              {t("offers.card.badge")}
            </span>
          </div>
          <div className="space-y-2 p-3">
            <p className="line-clamp-2 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
              {values.content.trim() || t("offers.card.untitled")}
            </p>
            <OfferPriceDisplay
              oldPrice={Number.isFinite(oldPriceNum) ? oldPriceNum : null}
              offerPrice={Number.isFinite(offerPriceNum) ? offerPriceNum : null}
            />
            <div className="flex flex-wrap items-center gap-2">
              <OfferStatusBadge status={previewStatus} />
              {dateLabel ? (
                <span className="text-[0.7rem] text-[var(--wesal-muted)]">{dateLabel}</span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2 text-[0.7rem] leading-5 text-[var(--wesal-maroon-dark)]">
          {mode === "edit" ? t("offers.form.editNote") : t("offers.form.createNote")}
        </p>
      </aside>
    </div>
  );
}
