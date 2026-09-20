"use client";

import { useCallback, useState } from "react";
import LockHallActionButton from "@/components/admin/halls/LockHallActionButton";
import { useLockHall } from "@/hooks/useLockHall";
import { canLockAdminHall } from "@/lib/admin-halls-mapper";
import type { AdminHallLockResult } from "@/types/admin-halls";
import { useT } from "@/i18n";

type AdminHallLockControlsProps = {
  hallId: string;
  adminLocked: boolean;
  variant?: "primary" | "soft";
  onLocked?: (result: AdminHallLockResult) => void;
};

export default function AdminHallLockControls({
  hallId,
  adminLocked,
  variant = "primary",
  onLocked,
}: AdminHallLockControlsProps) {
  const t = useT();
  const [toastKey, setToastKey] = useState<string | null>(null);

  const lockState = useLockHall({
    onLocked: (result) => {
      setToastKey(
        result.adminLocked ? "admin.lock.success" : "admin.lock.alreadyLocked",
      );
      onLocked?.(result);
    },
  });

  const closeToast = useCallback(() => setToastKey(null), []);
  const canLock = canLockAdminHall(adminLocked);

  if (!canLock && !toastKey && !lockState.errorKey) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      {toastKey ? (
        <p
          className="rounded-xl bg-[#e8f6ee] px-3 py-2 text-sm text-[#17663a]"
          role="status"
          data-testid="admin-hall-lock-toast"
        >
          {t(toastKey)}
        </p>
      ) : null}

      {lockState.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(lockState.errorKey)}
        </p>
      ) : null}

      {canLock ? (
        <LockHallActionButton
          disabled={lockState.pending}
          pending={lockState.pending}
          variant={variant}
          onLock={() => {
            lockState.clearError();
            closeToast();
            void lockState.lock(hallId);
          }}
        />
      ) : null}
    </div>
  );
}
