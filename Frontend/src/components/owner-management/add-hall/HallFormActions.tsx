"use client";

import Link from "next/link";
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
  /** Associate submit with a form rendered elsewhere on the page. */
  formId?: string;
  /**
   * Edit-end footer: summary card + cancel, aligned to the visual start (right in RTL).
   */
  endCard?: {
    cancelHref: string;
    cancelLabel?: string;
  };
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
  formId,
  endCard,
}: HallFormActionsProps) {
  const t = useT();
  const resolvedError = resolveMessage(formError);
  const disabled = isSubmitting || submitDisabled;

  if (endCard) {
    return (
      <div className="owner-add-hall-actions flex h-full min-w-0">
        <div className="flex h-full w-full min-w-0 flex-col gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,45,0.05)] sm:p-5">
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
                aria-hidden="true"
              >
                <CheckIcon />
              </span>
              <p className="text-sm font-extrabold text-[var(--wesal-text)] sm:text-[0.95rem]">
                {t("owner.management.hallEdit.endTitle")}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-6 text-[var(--wesal-muted)]">
              {t("owner.management.hallEdit.endHint")}
            </p>

            {isSuccess ? (
              <p
                role="status"
                className="seeker-settings-success mt-3 break-words"
                data-testid={successTestId}
              >
                {successMessage ?? t("owner.management.addHall.success")}
              </p>
            ) : null}

            {resolvedError && !isSuccess ? (
              <p
                role="alert"
                className="seeker-settings-alert mt-3 break-words"
                data-testid={errorTestId}
              >
                {resolvedError}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex min-w-0 flex-col gap-2.5 border-t border-[var(--wesal-border)] pt-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              form={formId}
              disabled={disabled}
              aria-busy={isSubmitting || undefined}
              data-testid={submitTestId}
              className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold"
            >
              {isSubmitting ? (
                savingLabel ?? t("owner.management.addHall.actions.saving")
              ) : (
                <>
                  <span>{submitLabel ?? t("owner.management.addHall.actions.submit")}</span>
                  <SaveIcon />
                </>
              )}
            </button>
            <Link
              href={endCard.cancelHref}
              className="btn-outline inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-bold"
              data-testid="owner-hall-edit-cancel"
            >
              {endCard.cancelLabel ?? t("owner.management.hallEdit.actions.cancel")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-add-hall-actions min-w-0 space-y-4">
      <div className="min-h-[0] space-y-3 text-center" aria-live="polite">
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

      <div className="w-full">
        <button
          type="submit"
          form={formId}
          disabled={disabled}
          aria-busy={isSubmitting || undefined}
          data-testid={submitTestId}
          className="btn-primary inline-flex min-h-11 w-full items-center justify-center sm:w-auto"
        >
          {isSubmitting
            ? (savingLabel ?? t("owner.management.addHall.actions.saving"))
            : (submitLabel ?? t("owner.management.addHall.actions.submit"))}
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m8.2 12.2 2.5 2.5 5.1-5.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M5 5.8A1.8 1.8 0 0 1 6.8 4H16l3 3v11.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.2V5.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 4.2v4.6h7.2V4.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 18.5v-5.2h8v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
