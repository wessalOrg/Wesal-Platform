"use client";

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

  const lockState = useLockHall({
    onLocked: (result) => {
      onLocked?.(result);
    },
  });

  const canLock = canLockAdminHall(adminLocked);

  if (!canLock && !lockState.errorKey) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
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
            void lockState.lock(hallId);
          }}
        />
      ) : null}
    </div>
  );
}
