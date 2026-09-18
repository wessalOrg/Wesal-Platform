"use client";

import { useT } from "@/i18n";

type HallFormActionsProps = {
  isSubmitting: boolean;
  formError: string | null;
  isSuccess: boolean;
  resolveMessage: (value: string | null) => string | null;
  /** Optional overrides for edit flow (US-OWNER-07). */
  submitLabel?: string;
  savingLabel?: string;
  successMessage?: string;
  submitDisabled?: boolean;
  submitTestId?: string;
  successTestId?: string;
  errorTestId?: string;
};

export default function HallFormActions({
  isSubmitting,
  formError,
  isSuccess,
  resolveMessage,
  submitLabel,
  savingLabel,
  successMessage,
  submitDisabled = false,
  submitTestId = "owner-add-hall-submit",
  successTestId = "owner-add-hall-success",
  errorTestId = "owner-add-hall-form-error",
}: HallFormActionsProps) {
  const t = useT();
  const resolvedError = resolveMessage(formError);
  const disabled = isSubmitting || submitDisabled;

  return (
    <div className="owner-add-hall-actions seeker-settings-card min-w-0 space-y-4">
      <div className="min-h-[0] space-y-3" aria-live="polite">
        {isSuccess ? (
          <p
            role="status"
            className="seeker-settings-success break-words"
            data-testid={successTestId}
          >
            {successMessage ?? t("owner.management.addHall.success")}
          </p>
        ) : null}

        {resolvedError && !isSuccess ? (
          <p
            role="alert"
            className="seeker-settings-alert break-words"
            data-testid={errorTestId}
          >
            {resolvedError}
          </p>
        ) : null}
      </div>

      <div className="seeker-settings-actions">
        <button
          type="submit"
          disabled={disabled}
          aria-busy={isSubmitting || undefined}
          data-testid={submitTestId}
          className="btn-primary inline-flex min-h-12 w-full items-center justify-center px-6 sm:w-auto sm:min-w-[12rem]"
        >
          {isSubmitting
            ? (savingLabel ?? t("owner.management.addHall.actions.saving"))
            : (submitLabel ?? t("owner.management.addHall.actions.submit"))}
        </button>
      </div>
    </div>
  );
}
