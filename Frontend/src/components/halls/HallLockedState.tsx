"use client";

import SystemLockedState from "@/components/halls/SystemLockedState";
import { useT } from "@/i18n";
import { hallLockedMessageKey, type BookingDataLockReason } from "@/lib/hall-access";

type HallLockedStateProps = {
  reason: BookingDataLockReason;
};

export default function HallLockedState({ reason }: HallLockedStateProps) {
  const t = useT();

  if (reason === "system") {
    return <SystemLockedState />;
  }

  return (
    <section
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4 sm:p-6"
      role="status"
      data-testid="owner-hall-locked-state"
      data-lock-reason={reason}
    >
      <h2 className="text-base font-bold text-[var(--wesal-maroon)] sm:text-lg">
        {t("owner.hallAccess.locked.title")}
      </h2>
      <p className="mt-2 break-words text-sm leading-7 text-[var(--wesal-text)]">
        {t(hallLockedMessageKey(reason))}
      </p>
    </section>
  );
}
