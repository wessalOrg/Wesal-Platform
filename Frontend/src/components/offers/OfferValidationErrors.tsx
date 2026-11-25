"use client";

import { useId, useState } from "react";
import { useT } from "@/i18n";
import { getOfferDateFieldErrors, type OfferField, type OfferFieldErrors, type OfferValidationInput } from "@/lib/offer-form-validation";
import { OFFER_CONTENT_MAX, OFFER_IMAGES_MAX } from "@/lib/offer-validation";

function FieldError({ id, field, message }: { id: string; field: OfferField; message?: string }) {
  const t = useT();
  return message ? <p id={id} role="alert" data-testid={`offer-error-${field}`} className="mt-1 text-xs leading-6 text-[#b42318]">
    {t(message, { count: message === "offers.validation.titleMax" ? OFFER_CONTENT_MAX : OFFER_IMAGES_MAX })}
  </p> : null;
}

export function useOfferValidationErrors() {
  const id = useId();
  const [errors, setErrors] = useState<OfferFieldErrors>({});
  const errorId = (field: OfferField) => `${id}-${field}-error`;
  return {
    errors,
    setErrors,
    clearErrors: () => setErrors({}),
    clearNonDateErrors: () => setErrors((previous) => ({ startsAt: previous.startsAt, endsAt: previous.endsAt })),
    revalidateDates: (input: Pick<OfferValidationInput, "startsAt" | "endsAt">) => setErrors((previous) => {
      if (!previous.startsAt && !previous.endsAt) return previous;
      const { startsAt, endsAt } = getOfferDateFieldErrors(input);
      return { ...previous, startsAt, endsAt };
    }),
    fieldProps: (field: OfferField) => ({
      "data-testid": `offer-field-${field}`,
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? errorId(field) : undefined,
    }),
    errorFor: (field: OfferField) => <FieldError id={errorId(field)} field={field} message={errors[field]} />,
  };
}
