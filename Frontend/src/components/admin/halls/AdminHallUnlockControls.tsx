"use client";

import { useCallback, useState } from "react";
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
  lockBadgeVisible?: boolean;
  variant?: "primary" | "soft";
  showBadge?: boolean;
  onUnlocked?: (result: AdminHallUnlockResult) => void;
};

export default function AdminHallUnlockControls({
  hallId,
  adminLocked,
  systemLocked,
  lockBadgeVisible = false,
  variant = "primary",
  showBadge = true,
  onUnlocked,
}: AdminHallUnlockControlsProps) {
  const t = useT();
  const [toastKey, setToastKey] = useState<string | null>(null);

  const unlockState = useUnlockHall({
    onUnlocked: (result) => {
      setToastKey(
        result.systemLocked
          ? "admin.halls.unlock.toast.unpaidLocked"
          : "admin.halls.unlock.toast.restored",
      );
      onUnlocked?.(result);
    },
  });

  const closeToast = useCallback(() => setToastKey(null), []);
  const canUnlock = canUnlockAdminHall(adminLocked);
  const badgeVisible = showBadge && (adminLocked || systemLocked || lockBadgeVisible);

  if (!canUnlock && !badgeVisible && !toastKey && !unlockState.errorKey) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      {toastKey ? (
        <p
          className={
            toastKey.endsWith("unpaidLocked")
              ? "rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a12]"
              : "rounded-xl bg-[#e8f6ee] px-3 py-2 text-sm text-[#17663a]"
          }
          role="status"
          data-testid="admin-hall-unlock-toast"
        >
          {t(toastKey)}
        </p>
      ) : null}

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
              closeToast();
              void unlockState.unlock(hallId);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
