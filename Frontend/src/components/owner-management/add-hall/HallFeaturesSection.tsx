"use client";

import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useHallCatalogs } from "@/hooks/useHallCatalogs";
import { useT } from "@/i18n";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type HallFeaturesSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<HallRegistrationFormValues>) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

export default function HallFeaturesSection({
  values,
  fieldErrors,
  disabled,
  onChange,
  resolveError,
}: HallFeaturesSectionProps) {
  const t = useT();
  const { features } = useHallCatalogs();
  const featuresError = resolveError(fieldErrors.features);
  const otherFeaturesError = resolveError(fieldErrors.otherFeatures);

  const toggleFeature = (feature: string) => {
    const toggled = values.features.includes(feature)
      ? values.features.filter((item) => item !== feature)
      : [...values.features, feature];
    onChange({ features: toggled });
  };

  return (
    <HallFormSection
      id="hall-features-heading"
      title={t("owner.management.addHall.sections.features")}
    >
      {features.length > 0 ? (
        <HallFormField
          id="hall-features"
          label={t("owner.management.addHall.fields.features")}
          error={featuresError}
          hint={t("owner.management.addHall.fields.featuresHint")}
        >
          <fieldset
            aria-invalid={featuresError ? true : undefined}
            aria-describedby={
              featuresError ? "hall-features-error" : "hall-features-hint"
            }
          >
            <legend className="sr-only">
              {t("owner.management.addHall.fields.features")}
            </legend>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const selected = values.features.includes(feature);
                return (
                  <button
                    key={feature}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    disabled={disabled}
                    className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-[var(--wesal-maroon)] bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
                        : "border-[var(--wesal-border)] bg-white text-[var(--wesal-text)] hover:border-[var(--wesal-maroon)]/40"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    onClick={() => toggleFeature(feature)}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? "border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-white"
                          : "border-[var(--wesal-border)] bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {selected ? (
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-3.5 w-3.5"
                        >
                          <path
                            d="M5 10.5 8.25 13.75 15 6.75"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="truncate">{feature}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </HallFormField>
      ) : null}

      <div className="md:col-span-2">
        <HallFormField
          id="hall-other-features"
          label={t("owner.management.addHall.fields.otherFeatures")}
          error={otherFeaturesError}
          hint={t("owner.management.addHall.fields.otherFeaturesHint")}
        >
          <textarea
            id="hall-other-features"
            rows={3}
            value={values.otherFeatures}
            disabled={disabled}
            aria-invalid={otherFeaturesError ? true : undefined}
            aria-describedby={
              otherFeaturesError
                ? "hall-other-features-error"
                : "hall-other-features-hint"
            }
            onChange={(event) =>
              onChange({ otherFeatures: event.target.value })
            }
            className={`${hallFieldClassName(Boolean(otherFeaturesError))} min-h-[5.5rem] max-w-full resize-y break-words`}
          />
        </HallFormField>
      </div>
    </HallFormSection>
  );
}