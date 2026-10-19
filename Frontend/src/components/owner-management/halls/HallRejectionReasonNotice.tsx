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
      className="min-w-0 rounded-2xl border border-[#f1c0bb] bg-[#fdecea] p-4 sm:p-5"
      role="status"
      data-testid="hall-rejection-reason"
      data-hall-id={hallId}
    >
      <p className="text-sm font-bold text-[#b42318]">{t("owner.hallRejection.title")}</p>
      {status === "loading" || status === "idle" ? (
        <p className="mt-2 text-sm text-[var(--wesal-muted)]">{t("common.loading")}</p>
      ) : status === "found" && reason ? (
        <p
          className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-[var(--wesal-text)]"
          data-testid="hall-rejection-reason-text"
        >
          {reason}
        </p>
      ) : (
        <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
          {status === "error"
            ? t("owner.hallRejection.error")
            : t("owner.hallRejection.unavailable")}
        </p>
      )}
      <p className="mt-2 text-xs leading-6 text-[var(--wesal-muted)]">
        {t("owner.hallRejection.hint")}
      </p>
      <Link
        href={ownerAdminMessagesPath(hallId)}
        className="btn-outline mt-3 inline-flex min-h-10 items-center"
      >
        {t("owner.hallRejection.contact")}
      </Link>
    </aside>
  );
}
