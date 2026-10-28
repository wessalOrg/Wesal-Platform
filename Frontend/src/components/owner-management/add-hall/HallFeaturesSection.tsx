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
      icon={<HallFeaturesIcon />}
      className="!space-y-3"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3">
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
              <div className="hall-features-pick-grid min-w-0">
                {features.map((feature) => {
                  const selected = values.features.includes(feature);
                  return (
                    <button
                      key={feature}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      disabled={disabled}
                      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium transition ${
                        selected
                          ? "border-[var(--wesal-maroon)] bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
                          : "border-[color-mix(in_srgb,var(--wesal-maroon)_16%,var(--wesal-border))] bg-white text-[var(--wesal-text)] hover:border-[var(--wesal-maroon)]/40"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      onClick={() => toggleFeature(feature)}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-white"
                            : "border-[color-mix(in_srgb,var(--wesal-maroon)_22%,var(--wesal-border))] bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {selected ? (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            className="h-2.5 w-2.5"
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

        <HallFormField
          id="hall-other-features"
          label={t("owner.management.addHall.fields.otherFeatures")}
          error={otherFeaturesError}
          hint={t("owner.management.addHall.fields.otherFeaturesHint")}
        >
          <textarea
            id="hall-other-features"
            rows={2}
            value={values.otherFeatures}
            disabled={disabled}
            aria-invalid={otherFeaturesError ? true : undefined}
            aria-describedby={
              otherFeaturesError
                ? "hall-other-features-error"
                : "hall-other-features-hint"
            }
            onChange={(event) => onChange({ otherFeatures: event.target.value })}
            className={`${hallFieldClassName(Boolean(otherFeaturesError))} min-h-[3.25rem] max-w-xl resize-y break-words text-sm`}
          />
        </HallFormField>
      </div>
    </HallFormSection>
  );
}

function HallFeaturesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M7 3.75h7.2L19 8.55V20.25a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20.25V5.25A1.5 1.5 0 0 1 7 3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 3.75V8.1H19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8.2 12.2 1.35 1.35 2.55-2.7M8.2 16.35l1.35 1.35 2.55-2.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.4 12.85h3.3M13.4 17h3.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
