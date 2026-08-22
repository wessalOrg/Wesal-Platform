"use client";

import { useT } from "@/i18n";

type HallDetailsErrorProps = {
  message: string;
  onRetry: () => void;
};

export default function HallDetailsError({ message, onRetry }: HallDetailsErrorProps) {
  const t = useT();

  return (
    <div
      className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-8 text-center"
      role="alert"
      data-testid="hall-details-error"
    >
      <p className="text-lg font-bold text-[var(--wesal-maroon)]">
        {t("halls.details.errorTitle")}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-text)]">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-5">
        {t("common.retry")}
      </button>
    </div>
  );
}
