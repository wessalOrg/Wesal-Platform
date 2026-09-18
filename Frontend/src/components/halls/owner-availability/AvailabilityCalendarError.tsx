"use client";

import { useT } from "@/i18n";

type AvailabilityCalendarErrorProps = {
  message: string;
  onRetry: () => void;
};

export default function AvailabilityCalendarError({
  message,
  onRetry,
}: AvailabilityCalendarErrorProps) {
  const t = useT();

  return (
    <div
      className="rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-5"
      role="alert"
      data-testid="owner-availability-error"
    >
      <p className="text-sm font-bold text-[var(--wesal-maroon)]">
        {t("owner.availability.errorTitle")}
      </p>
      <p className="mt-1 break-words text-sm leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]">
        {message}
      </p>
      <button
        type="button"
        className="btn-outline mt-3 min-h-11 w-full sm:w-auto"
        onClick={onRetry}
        data-testid="owner-availability-retry"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
