"use client";

import { useT } from "@/i18n";
import type { HallEditability } from "@/types/hall-owner-hall-management";

type HallEditabilityNoticeProps = {
  editability: HallEditability;
};

/** Admin/system lock is a business state — approval status never freezes the form. */
export default function HallEditabilityNotice({
  editability,
}: HallEditabilityNoticeProps) {
  const t = useT();

  if (editability !== "locked") return null;

  const messageKey = "owner.management.hallEdit.lockedNotice";

  return (
    <div
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3"
      role="status"
      data-testid="owner-hall-editability-notice"
      data-editability={editability}
    >
      <p className="break-words text-sm leading-relaxed text-[var(--wesal-maroon)]">
        {t(messageKey)}
      </p>
    </div>
  );
}
