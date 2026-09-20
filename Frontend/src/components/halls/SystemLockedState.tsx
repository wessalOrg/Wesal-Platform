"use client";

import { useT } from "@/i18n";

export default function SystemLockedState() {
  const t = useT();

  return (
    <section
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4 sm:p-6"
      role="status"
      data-testid="owner-system-locked-state"
    >
      <h2 className="text-base font-bold text-[var(--wesal-maroon)] sm:text-lg">
        {t("owner.hallAccess.systemLocked.title")}
      </h2>
      <p className="mt-2 break-words text-sm leading-7 text-[var(--wesal-text)]">
        {t("owner.hallAccess.systemLocked.body")}
      </p>
    </section>
  );
}
