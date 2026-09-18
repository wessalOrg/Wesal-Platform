"use client";

import { useT } from "@/i18n";

export default function ManagementSectionError({
  messageKey,
  onRetry,
}: {
  messageKey?: string | null;
  onRetry: () => void;
}) {
  const t = useT();
  const message =
    messageKey && messageKey.startsWith("errors.")
      ? t(messageKey)
      : t("owner.management.loadError");

  return (
    <section
      className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6"
      data-testid="owner-management-section-error"
      role="alert"
    >
      <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
        {t("owner.management.profileTitle")}
      </h2>
      <p className="mt-3 break-words text-sm leading-7 text-[var(--wesal-muted)]">
        {message}
      </p>
      <button
        type="button"
        className="btn-outline mt-5 min-h-11 w-full sm:w-auto"
        data-testid="owner-management-retry"
        onClick={onRetry}
      >
        {t("common.retry")}
      </button>
    </section>
  );
}
