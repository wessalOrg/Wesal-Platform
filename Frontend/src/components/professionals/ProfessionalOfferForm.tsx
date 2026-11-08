"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { ApiError, isForbiddenApiError, isUnauthorizedApiError } from "@/lib/api-error";
import {
  OFFER_CONTENT_MAX,
  OFFER_IMAGE_ACCEPT,
  OFFER_IMAGES_MAX,
  calculateOfferDiscountPercent,
  parseOfferMoney,
  parseOptionalOfferMoney,
  validateOfferDateRange,
  validateOfferPricePair,
} from "@/lib/offer-validation";
import {
  PROFESSIONAL_POST_IMAGE_MAX_BYTES,
  validateProfessionalPostImages,
} from "@/lib/professional-post-validation";
import { useT } from "@/i18n";
import { createProfessionalOffer } from "@/services/professional-offers";

type ProfessionalOfferFormProps = {
  onClose: () => void;
  onSaved: () => void;
};

export default function ProfessionalOfferForm({
  onClose,
  onSaved,
}: ProfessionalOfferFormProps) {
  const t = useT();
  const titleId = useId();
  const contentId = useId();
  const oldPriceId = useId();
  const offerPriceId = useId();
  const priceBoxId = useId();
  const startsId = useId();
  const endsId = useId();
  const fileId = useId();
  const objectUrls = useRef<string[]>([]);

  const [content, setContent] = useState("");
  const [oldPriceText, setOldPriceText] = useState("");
  const [offerPriceText, setOfferPriceText] = useState("");
  const [priceBoxText, setPriceBoxText] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current = [];
    };
  }, []);

  const oldParsed = parseOfferMoney(oldPriceText);
  const offerParsed = parseOfferMoney(offerPriceText);
  const priceBoxParsed = parseOptionalOfferMoney(priceBoxText);
  const discount =
    oldParsed.value != null && offerParsed.value != null
      ? calculateOfferDiscountPercent(oldParsed.value, offerParsed.value)
      : null;

  const replacePreviews = (nextFiles: File[]) => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    const next = nextFiles.map((file) => URL.createObjectURL(file));
    objectUrls.current = next;
    setPreviews(next);
  };

  const validate = (): CreatePayload | null => {
    if (oldParsed.issue || oldParsed.value == null) {
      setFieldError(t("professionals.offers.errors.oldPriceInvalid"));
      return null;
    }
    if (offerParsed.issue || offerParsed.value == null) {
      setFieldError(t("professionals.offers.errors.offerPriceInvalid"));
      return null;
    }
    if (validateOfferPricePair(oldParsed.value, offerParsed.value)) {
      setFieldError(t("professionals.offers.errors.offerNotLower"));
      return null;
    }
    if (priceBoxParsed.issue) {
      setFieldError(t("professionals.offers.errors.priceBoxInvalid"));
      return null;
    }
    const dates = validateOfferDateRange(startsLocal, endsLocal);
    if (dates.issue || !dates.startsAt || !dates.endsAt) {
      setFieldError(
        dates.issue === "endBeforeStart"
          ? t("professionals.offers.errors.endBeforeStart")
          : dates.issue === "endNotFuture"
            ? t("professionals.offers.errors.endNotFuture")
            : t("professionals.offers.errors.datesRequired"),
      );
      return null;
    }
    const imagesIssue = validateProfessionalPostImages(files, { required: false });
    if (imagesIssue) {
      setFieldError(t("professionals.offers.errors.imagesInvalid"));
      return null;
    }
    if (!content.trim() && files.length === 0) {
      setFieldError(t("professionals.offers.errors.bodyRequired"));
      return null;
    }
    if (content.trim().length > OFFER_CONTENT_MAX) {
      setFieldError(t("professionals.offers.errors.contentTooLong"));
      return null;
    }
    setFieldError(null);
    return {
      content,
      oldPrice: oldParsed.value,
      offerPrice: offerParsed.value,
      priceBox: priceBoxParsed.value,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      images: files,
    };
  };

  type CreatePayload = {
    content: string;
    oldPrice: number;
    offerPrice: number;
    priceBox: number | null;
    startsAt: string;
    endsAt: string;
    images: File[];
  };

  const onSubmit = async () => {
    if (submitting) return;
    const payload = validate();
    if (!payload) return;
    setSubmitting(true);
    setError(null);
    try {
      await createProfessionalOffer(payload);
      onSaved();
      onClose();
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        setError(t("professionals.offers.errors.unauthorized"));
      } else if (isForbiddenApiError(err)) {
        setError(t("professionals.offers.errors.forbidden"));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("professionals.offers.errors.conflict"));
      } else {
        setError(t("professionals.offers.errors.createFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-3xl border border-[color-mix(in_srgb,var(--wesal-maroon)_14%,white)] bg-white p-4 shadow-[0_16px_36px_rgba(88,40,48,0.1)] sm:p-5"
      role="dialog"
      aria-labelledby={titleId}
      data-testid="professional-offer-form"
    >
      <h2 id={titleId} className="text-lg font-bold text-[var(--wesal-text)]">
        {t("professionals.offers.createTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
        {t("professionals.offers.createSubtitle")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={oldPriceId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.offers.oldPriceLabel")}
          </label>
          <input
            id={oldPriceId}
            value={oldPriceText}
            disabled={submitting}
            inputMode="decimal"
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            placeholder={t("professionals.offers.pricePlaceholder")}
            onChange={(e) => setOldPriceText(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={offerPriceId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.offers.offerPriceLabel")}
          </label>
          <input
            id={offerPriceId}
            value={offerPriceText}
            disabled={submitting}
            inputMode="decimal"
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            placeholder={t("professionals.offers.pricePlaceholder")}
            onChange={(e) => setOfferPriceText(e.target.value)}
          />
        </div>
      </div>

      {discount != null && oldParsed.value != null && offerParsed.value != null ? (
        <div
          className="mt-3 space-y-1 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2 text-sm"
          data-testid="professional-offer-discount-preview"
        >
          <p className="font-semibold text-[var(--wesal-maroon)]">
            {t("professionals.offers.discountPreview", { percent: String(discount) })}
          </p>
          <p className="text-[var(--wesal-text)]">
            {t("professionals.offers.pricePreview", {
              old: String(oldParsed.value),
              offer: String(offerParsed.value),
            })}
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={startsId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.offers.startsLabel")}
          </label>
          <input
            id={startsId}
            type="datetime-local"
            value={startsLocal}
            disabled={submitting}
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={endsId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.offers.endsLabel")}
          </label>
          <input
            id={endsId}
            type="datetime-local"
            value={endsLocal}
            disabled={submitting}
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            onChange={(e) => setEndsLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor={priceBoxId} className="text-sm font-semibold text-[var(--wesal-text)]">
          {t("professionals.offers.priceBoxLabel")}
        </label>
        <input
          id={priceBoxId}
          value={priceBoxText}
          disabled={submitting}
          inputMode="decimal"
          className={`${hallFieldClassName(false)} mt-2 w-full`}
          placeholder={t("professionals.offers.pricePlaceholder")}
          onChange={(e) => setPriceBoxText(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <label htmlFor={contentId} className="text-sm font-semibold text-[var(--wesal-text)]">
          {t("professionals.offers.contentLabel")}
        </label>
        <textarea
          id={contentId}
          value={content}
          disabled={submitting}
          rows={3}
          maxLength={OFFER_CONTENT_MAX + 40}
          className={`${hallFieldClassName(false)} mt-2 min-h-[5rem] w-full resize-y`}
          placeholder={t("professionals.offers.contentPlaceholder")}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold text-[var(--wesal-text)]">
          {t("professionals.offers.imagesLabel")}
        </p>
        <p className="mt-1 text-xs text-[var(--wesal-muted)]">
          {t("professionals.offers.imagesHint", {
            max: String(OFFER_IMAGES_MAX),
            mb: String(PROFESSIONAL_POST_IMAGE_MAX_BYTES / (1024 * 1024)),
          })}
        </p>
        {previews.length > 0 ? (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {previews.map((preview, index) => (
              <li key={preview} className="relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  className="absolute end-1 top-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white"
                  disabled={submitting}
                  onClick={() => {
                    const next = files.filter((_, i) => i !== index);
                    setFiles(next);
                    replacePreviews(next);
                  }}
                >
                  {t("professionals.posts.removeImage")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label
          htmlFor={fileId}
          className="btn-outline mt-3 inline-flex !min-h-10 cursor-pointer items-center px-3 text-sm"
        >
          {t("professionals.offers.addImages")}
        </label>
        <input
          id={fileId}
          type="file"
          accept={OFFER_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          disabled={submitting || files.length >= OFFER_IMAGES_MAX}
          onChange={(event) => {
            const picked = event.target.files ? Array.from(event.target.files) : [];
            const next = [...files, ...picked].slice(0, OFFER_IMAGES_MAX);
            setFiles(next);
            replacePreviews(next);
            event.target.value = "";
          }}
        />
      </div>

      {fieldError ? (
        <p className="mt-3 text-sm text-[#b42318]" role="alert">
          {fieldError}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-primary !min-h-11"
          disabled={submitting}
          aria-busy={submitting || undefined}
          data-testid="professional-offer-submit"
          onClick={() => void onSubmit()}
        >
          {submitting
            ? t("professionals.offers.publishing")
            : t("professionals.offers.publish")}
        </button>
        <button
          type="button"
          className="btn-outline !min-h-11"
          disabled={submitting}
          onClick={onClose}
        >
          {t("professionals.offers.cancel")}
        </button>
      </div>
    </section>
  );
}
