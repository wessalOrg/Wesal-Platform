"use client";

import Link from "next/link";
import { useHallRejectionReason } from "@/hooks/useHallRejectionReason";
import { ownerAdminMessagesPath } from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";

type HallRejectionReasonNoticeProps = {
  hallId: string;
  /** Only rejected halls show the notice. */
  rejected: boolean;
};

/** Shows the owner why the Admin rejected the hall, next to a path to talk to the Admin. */
export default function HallRejectionReasonNotice({
  hallId,
  rejected,
}: HallRejectionReasonNoticeProps) {
  const t = useT();
  const { status, reason } = useHallRejectionReason(hallId, rejected);

  if (!rejected) return null;

  return (
    <aside
      className="inline-flex w-fit max-w-sm items-start gap-2 rounded-xl border border-[#f1c0bb] bg-[#fdecea] px-2.5 py-2"
      role="status"
      data-testid="hall-rejection-reason"
      data-hall-id={hallId}
    >
      <WarningIcon />
      <div className="min-w-0">
        <p className="text-xs font-bold leading-snug text-[#b42318]">
          {t("owner.hallRejection.title")}
        </p>
        {status === "loading" || status === "idle" ? (
          <p className="mt-1 text-[11px] leading-snug text-[var(--wesal-muted)]">
            {t("common.loading")}
          </p>
        ) : status === "found" && reason ? (
          <p
            className="mt-1 whitespace-pre-line break-words text-[11px] leading-snug text-[var(--wesal-text)]"
            data-testid="hall-rejection-reason-text"
          >
            {reason}
          </p>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-[var(--wesal-muted)]">
            {status === "error"
              ? t("owner.hallRejection.error")
              : t("owner.hallRejection.unavailable")}
          </p>
        )}
        <p className="mt-1 text-[11px] leading-snug text-[var(--wesal-muted)]">
          {t("owner.hallRejection.hint")}
        </p>
        <Link
          href={ownerAdminMessagesPath(hallId)}
          className="mt-1.5 inline-flex min-h-7 items-center rounded-lg border border-[#f1c0bb] bg-white px-2.5 text-[11px] font-semibold text-[#b42318] hover:bg-[#fff7f6]"
        >
          {t("owner.hallRejection.contact")}
        </Link>
      </div>
    </aside>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b42318]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5 2.8 19.2a1.2 1.2 0 0 0 1.05 1.8h16.3a1.2 1.2 0 0 0 1.05-1.8L12 3.5Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}
