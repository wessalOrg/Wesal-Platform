"use client";

import { useId, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import WesalDateTimeField from "@/components/ui/WesalDateTimeField";
import { ApiError, isForbiddenApiError, isUnauthorizedApiError } from "@/lib/api-error";
import {
  calculateOfferDiscountPercent,
  parseOfferMoney,
  validateOfferDateRange,
} from "@/lib/offer-validation";
import { getOfferFieldErrors } from "@/lib/offer-form-validation";
import { useOfferValidationErrors } from "@/components/offers/OfferValidationErrors";
import { useT } from "@/i18n";
import { createHallOffer } from "@/services/hall-offers";

type HallOfferFormProps = {
  hallId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function HallOfferForm({
  hallId,
  onClose,
  onSaved,
}: HallOfferFormProps) {
  const t = useT();
  const { setErrors, clearErrors, fieldProps, errorFor } = useOfferValidationErrors();
  const titleId = useId();
  const oldPriceId = useId();
  const offerPriceId = useId();
  const startsId = useId();
  const endsId = useId();

  const [oldPriceText, setOldPriceText] = useState("");
  const [offerPriceText, setOfferPriceText] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const oldParsed = parseOfferMoney(oldPriceText);
  const offerParsed = parseOfferMoney(offerPriceText);
  const discount =
    oldParsed.value != null && offerParsed.value != null
      ? calculateOfferDiscountPercent(oldParsed.value, offerParsed.value)
      : null;

  const validate = () => {
    const errors = getOfferFieldErrors({ oldPrice: oldPriceText, offerPrice: offerPriceText,
      startsAt: startsLocal, endsAt: endsLocal });
    setErrors(errors);
    if (Object.keys(errors).length || oldParsed.value == null || offerParsed.value == null) return null;
    const dates = validateOfferDateRange(startsLocal, endsLocal);
    if (!dates.startsAt || !dates.endsAt) return null;
    return {
      oldBookingPrice: oldParsed.value,
      offerPrice: offerParsed.value,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
    };
  };

  const onSubmit = async () => {
    if (submitting) return;
    const payload = validate();
    if (!payload) return;
    setSubmitting(true);
    setError(null);
    try {
      await createHallOffer(hallId, payload);
      onSaved();
      onClose();
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        setError(t("owner.offers.errors.unauthorized"));
      } else if (isForbiddenApiError(err)) {
        setError(t("owner.offers.errors.forbidden"));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("owner.offers.errors.conflict"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("owner.offers.errors.notFound"));
      } else {
        setError(t("owner.offers.errors.createFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
      role="dialog"
      aria-labelledby={titleId}
      data-testid="hall-offer-form"
      data-hall-id={hallId}
    >
      <h3 id={titleId} className="text-lg font-bold text-[var(--wesal-maroon)]">
        {t("owner.offers.createTitle")}
      </h3>
      <p className="mt-1 text-sm text-[var(--wesal-muted)]">
        {t("owner.offers.createSubtitle")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={oldPriceId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.offers.oldPriceLabel")}
          </label>
          <input
            id={oldPriceId}
            value={oldPriceText}
              {...fieldProps("oldPrice")}
            disabled={submitting}
            inputMode="decimal"
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            placeholder={t("owner.offers.pricePlaceholder")}
            onChange={(e) => { setOldPriceText(e.target.value); clearErrors(); }}
          />
            {errorFor("oldPrice")}
        </div>
        <div>
          <label htmlFor={offerPriceId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.offers.offerPriceLabel")}
          </label>
          <input
            id={offerPriceId}
            value={offerPriceText}
              {...fieldProps("offerPrice")}
            disabled={submitting}
            inputMode="decimal"
            className={`${hallFieldClassName(false)} mt-2 w-full`}
            placeholder={t("owner.offers.pricePlaceholder")}
            onChange={(e) => { setOfferPriceText(e.target.value); clearErrors(); }}
          />
            {errorFor("offerPrice")}
        </div>
      </div>

      {discount != null ? (
        <div
          className="mt-3 space-y-1 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2 text-sm"
          data-testid="hall-offer-discount-preview"
        >
          <p className="font-semibold text-[var(--wesal-maroon)]">
            {t("owner.offers.discountPreview", { percent: String(discount) })}
          </p>
          {oldParsed.value != null && offerParsed.value != null ? (
            <p className="text-[var(--wesal-text)]">
              {t("owner.offers.pricePreview", {
                old: String(oldParsed.value),
                offer: String(offerParsed.value),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={startsId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.offers.startsLabel")}
          </label>
          <div className="mt-2">
            <WesalDateTimeField
              id={startsId}
              value={startsLocal}
              {...fieldProps("startsAt")}
              disabled={submitting}
              triggerClassName={`${hallFieldClassName(false)} w-full`}
              onChange={(value) => { setStartsLocal(value); clearErrors(); }}
            />
            {errorFor("startsAt")}
          </div>
        </div>
        <div>
          <label htmlFor={endsId} className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.offers.endsLabel")}
          </label>
          <div className="mt-2">
            <WesalDateTimeField
              id={endsId}
              value={endsLocal}
              {...fieldProps("endsAt")}
              disabled={submitting}
              triggerClassName={`${hallFieldClassName(false)} w-full`}
              onChange={(value) => { setEndsLocal(value); clearErrors(); }}
            />
            {errorFor("endsAt")}
          </div>
        </div>
      </div>

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
          data-testid="hall-offer-submit"
          onClick={() => void onSubmit()}
        >
          {submitting ? t("owner.offers.publishing") : t("owner.offers.publish")}
        </button>
        <button
          type="button"
          className="btn-outline !min-h-11"
          disabled={submitting}
          onClick={onClose}
        >
          {t("owner.offers.cancel")}
        </button>
      </div>
    </section>
  );
}
