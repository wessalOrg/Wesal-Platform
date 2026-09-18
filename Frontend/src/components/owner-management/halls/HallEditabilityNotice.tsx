"use client";

import { useT } from "@/i18n";
import type { HallEditability } from "@/types/hall-owner-hall-management";

type HallEditabilityNoticeProps = {
  editability: HallEditability;
};

/** Locked / Under Review are business states — not technical errors. */
export default function HallEditabilityNotice({
  editability,
}: HallEditabilityNoticeProps) {
  const t = useT();

  if (editability === "editable") return null;

  const messageKey =
    editability === "underReview"
      ? "owner.management.hallEdit.underReviewNotice"
      : "owner.management.hallEdit.lockedNotice";

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
