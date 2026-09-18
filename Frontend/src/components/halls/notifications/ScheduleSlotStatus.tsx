"use client";

import { useT } from "@/i18n";
import type { ScheduleSlotKind } from "@/lib/owner-acceptance-ui";

type ScheduleSlotStatusProps = {
  kind: ScheduleSlotKind;
};

const styles: Record<ScheduleSlotKind, string> = {
  available: "bg-emerald-50 text-emerald-700",
  depositPending: "bg-[rgba(196,160,92,0.22)] text-[#8a6a2a] ring-1 ring-[rgba(196,160,92,0.35)]",
  booked: "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon-dark)]",
  published: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
};

export default function ScheduleSlotStatus({ kind }: ScheduleSlotStatusProps) {
  const t = useT();
  const label =
    kind === "depositPending"
      ? t("owner.schedule.depositPending")
      : kind === "published"
        ? t("owner.schedule.published")
        : kind === "booked"
          ? t("owner.schedule.booked")
          : t("owner.schedule.available");
  const hint =
    kind === "depositPending"
      ? t("owner.schedule.depositPendingHint")
      : kind === "published"
        ? t("owner.schedule.publishedHint")
        : label;
  const live = kind === "depositPending" || kind === "published";

  return (
    <span
      className={`max-w-[min(100%,11.5rem)] shrink-0 truncate rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${styles[kind]}`}
      title={hint}
      aria-label={hint}
      role={live ? "status" : undefined}
      data-testid="owner-schedule-slot-status"
      data-slot-kind={kind}
    >
      {label}
    </span>
  );
}
