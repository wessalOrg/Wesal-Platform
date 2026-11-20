"use client";

import { useMemo, useState, type FormEvent } from "react";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import WesalDateTimeField from "@/components/ui/WesalDateTimeField";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { useT } from "@/i18n";
import { formatOfferDateRange, resolveOfferMediaUrl } from "@/lib/offer-format";
import {
  datetimeLocalToIso,
  isoToDatetimeLocalValue,
  OFFER_CONTENT_MAX,
  OFFER_IMAGES_MAX,
  validateOfferDateRange,
} from "@/lib/offer-validation";
import { offerDiscountPercent, resolveOfferStatus } from "@/lib/offer-status";
import type { ProfessionalOffer } from "@/types/offers";
import OfferManageIcon from "./OfferManageIcon";
import PostEditorIcon from "@/components/professionals/PostEditorIcon";
import "./professional-offer-form.css";

const TITLE_MAX = OFFER_CONTENT_MAX;
const MAX_IMAGES = OFFER_IMAGES_MAX;

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
    startsAt: isoToDatetimeLocalValue(offer.startsAt),
    endsAt: isoToDatetimeLocalValue(offer.endsAt),
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
  const dates = validateOfferDateRange(values.startsAt, values.endsAt);
  if (dates.issue === "required" || !dates.startsAt || !dates.endsAt) {
    return dates.issue === "invalid"
      ? t("offers.validation.datesInvalid")
      : t("offers.validation.datesRequired");
  }
  if (dates.issue === "invalid") return t("offers.validation.datesInvalid");
  if (dates.issue === "endBeforeStart") return t("offers.validation.endAfterStart");
  if (dates.issue === "endNotFuture") {
    return t("offers.validation.endNotFuture");
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
  const previewStarts = datetimeLocalToIso(values.startsAt);
  const previewEnds = datetimeLocalToIso(values.endsAt);
  const previewStatus = resolveOfferStatus(
    previewStarts,
    previewEnds,
    initial?.stoppedAt ?? null,
  );
  const dateLabel = formatOfferDateRange(previewStarts, previewEnds, locale);

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
      className="offer-editor"
      data-testid="professional-offer-form"
    >
      <form
        onSubmit={handleSubmit}
        className="offer-editor-details"
      >
        <header className="offer-editor-heading">
          <span className="offer-editor-heading-icon"><OfferManageIcon name="tag" /></span>
          <div><h2>{t("offers.form.details")}</h2><p>{t("offers.form.detailsHint")}</p></div>
        </header>

        <div className="offer-editor-images">
          <p className="offer-editor-label">
            <PostEditorIcon name="image" />{t("offers.form.images")}
          </p>
          <div className="offer-editor-image-list">
            {values.existingImages.map((img) => (
              <div
                key={img.id}
                className="relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--wesal-border)]"
              >
                <AuthenticatedApiImage
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
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
              <label className="offer-editor-upload" aria-disabled={busy}>
                <PostEditorIcon name="image" />
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

        <label className="offer-editor-content">
          <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-[var(--wesal-maroon-dark)]">
            <span className="offer-editor-label"><PostEditorIcon name="document" />{t("offers.form.title")}</span>
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
              <span className="offer-editor-label"><PostEditorIcon name="price" />{t("offers.form.oldPrice")}<span aria-hidden="true">*</span></span>
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
              <span className="offer-editor-label"><OfferManageIcon name="tag" />{t("offers.form.offerPrice")}<span aria-hidden="true">*</span></span>
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
          <div>
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              <span className="offer-editor-label"><OfferManageIcon name="scheduled" />{t("offers.form.startsAt")}<span aria-hidden="true">*</span></span>
            </span>
            <WesalDateTimeField
              value={values.startsAt}
              disabled={busy}
              triggerClassName={hallFieldClassName(false)}
              onChange={(next) => patch({ startsAt: next })}
              testId="pro-offer-starts-at"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold text-[var(--wesal-maroon-dark)]">
              <span className="offer-editor-label"><OfferManageIcon name="scheduled" />{t("offers.form.endsAt")}<span aria-hidden="true">*</span></span>
            </span>
            <WesalDateTimeField
              value={values.endsAt}
              disabled={busy}
              triggerClassName={hallFieldClassName(false)}
              onChange={(next) => patch({ endsAt: next })}
              testId="pro-offer-ends-at"
            />
          </div>
        </div>

        {resolvedError ? (
          <p className="text-sm text-[#b42318]" role="alert">
            {resolvedError}
          </p>
        ) : null}

        <div className="offer-editor-footer">
          <button type="submit" className="btn-primary min-h-11 px-5" disabled={busy}>
            <PostEditorIcon name="send" />
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
            <PostEditorIcon name="close" />
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

      <aside className="offer-editor-aside">
        <section className="offer-editor-preview-panel">
        <h3 className="offer-editor-panel-title"><OfferManageIcon name="view" />{t("offers.form.preview")}</h3>
        <div className="offer-editor-preview-card">
          <div className="relative aspect-[4/3] bg-[var(--wesal-pink)]">
            <AuthenticatedApiImage
              src={previewImage || null}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--wesal-muted)]">
                  {t("offers.card.noImage")}
                </div>
              }
            />
            <span className="absolute end-3 top-3 rounded-md bg-[var(--wesal-maroon)] px-2 py-1 text-[0.65rem] font-bold text-white">
              {t("offers.card.badge")}
            </span>
          </div>
          <div className="space-y-2 p-3">
            <p className="line-clamp-2 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
              {values.content.trim() || t("offers.card.untitled")}
            </p>
            <OfferPriceDisplay
              oldPrice={values.oldPrice.trim() && Number.isFinite(oldPriceNum) ? oldPriceNum : null}
              offerPrice={values.offerPrice.trim() && Number.isFinite(offerPriceNum) ? offerPriceNum : null}
            />
            <div className="flex flex-wrap items-center gap-2">
              {previewStarts && previewEnds ? <OfferStatusBadge status={previewStatus} /> : null}
              {dateLabel ? (
                <span className="text-[0.7rem] text-[var(--wesal-muted)]">{dateLabel}</span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2 text-[0.7rem] leading-5 text-[var(--wesal-maroon-dark)]">
          {mode === "edit" ? t("offers.form.editNote") : t("offers.form.createNote")}
        </p>
        </section>
        <section className="offer-editor-status-panel">
          <h3 className="offer-editor-panel-title"><OfferManageIcon name="all" />{t("offers.form.statusTitle")}</h3>
          <p className="offer-editor-status-hint">{t("offers.form.statusHint")}</p>
          {(["scheduled", "active", "expired", ...(initial?.stoppedAt ? ["stopped" as const] : [])] as const).map((status) => (
            <div key={status} className="offer-editor-status" data-current={Boolean(previewStarts && previewEnds && previewStatus === status)}>
              <OfferManageIcon name={status} /><span>{t(`offers.status.${status}`)}</span><span className="offer-editor-status-dot" aria-hidden="true" />
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
