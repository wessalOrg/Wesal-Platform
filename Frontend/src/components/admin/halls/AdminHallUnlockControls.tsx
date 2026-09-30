"use client";

import AdminHallLockBadge from "@/components/admin/halls/AdminHallLockBadge";
import UnlockHallActionButton from "@/components/admin/halls/UnlockHallActionButton";
import { useUnlockHall } from "@/hooks/useUnlockHall";
import { canUnlockAdminHall } from "@/lib/admin-halls-mapper";
import type { AdminHallUnlockResult } from "@/types/admin-halls";
import { useT } from "@/i18n";

type AdminHallUnlockControlsProps = {
  hallId: string;
  adminLocked: boolean;
  systemLocked: boolean;
  variant?: "primary" | "soft";
  showBadge?: boolean;
  onUnlocked?: (result: AdminHallUnlockResult) => void;
};

export default function AdminHallUnlockControls({
  hallId,
  adminLocked,
  systemLocked,
  variant = "primary",
  showBadge = true,
  onUnlocked,
}: AdminHallUnlockControlsProps) {
  const t = useT();

  const unlockState = useUnlockHall({
    onUnlocked: (result) => {
      onUnlocked?.(result);
    },
  });

  const canUnlock = canUnlockAdminHall(adminLocked);
  const badgeVisible = showBadge && (adminLocked || systemLocked);

  if (!canUnlock && !badgeVisible && !unlockState.errorKey) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      {unlockState.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(unlockState.errorKey)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {badgeVisible ? (
          <AdminHallLockBadge adminLocked={adminLocked} systemLocked={systemLocked} />
        ) : null}
        {canUnlock ? (
          <UnlockHallActionButton
            disabled={unlockState.pending}
            pending={unlockState.pending}
            variant={variant}
            onUnlock={() => {
              unlockState.clearError();
              void unlockState.unlock(hallId);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
