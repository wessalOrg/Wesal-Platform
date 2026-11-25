"use client";

import { useT } from "@/i18n";
import { getHallLockStatus, type HallAccessState } from "@/lib/hall-access";

/** Unknown is informational, not a new approval, payment, or permission rule. */
export default function HallLockStatusNotice({ access, loading = false }: {
  access: Pick<HallAccessState, "adminLocked" | "systemLocked">;
  loading?: boolean;
}) {
  const t = useT();
  if (!loading && getHallLockStatus(access) !== "unknown") return null;
  return (
    <p role="status" aria-busy={loading}
      className="break-words text-xs leading-5 text-[var(--wesal-muted)]"
      data-testid="hall-lock-status" data-lock-status={loading ? "loading" : "unknown"}>
      {t(loading ? "owner.hallAccess.status.loading" : "owner.hallAccess.status.unknown")}
    </p>
  );
}
