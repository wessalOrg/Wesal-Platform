"use client";

import { useT } from "@/i18n";
import { resolveAdminHallLockAccess } from "@/lib/admin-halls-mapper";
import type { AdminHallLockAccess } from "@/types/admin-halls";

type AdminHallLockBadgeProps = {
  adminLocked: boolean;
  systemLocked: boolean;
};

const styles: Record<AdminHallLockAccess, string> = {
  adminLocked:
    "bg-[var(--wesal-pink)] text-[var(--wesal-maroon-dark)] ring-1 ring-[rgba(168,98,103,0.35)]",
  unpaidLocked:
    "bg-[rgba(196,160,92,0.2)] text-[#7a5c1f] ring-1 ring-[rgba(196,160,92,0.45)]",
  unlocked: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
};

export default function AdminHallLockBadge({
  adminLocked,
  systemLocked,
}: AdminHallLockBadgeProps) {
  const t = useT();
  const access = resolveAdminHallLockAccess(adminLocked, systemLocked);
  const label =
    access === "unpaidLocked"
      ? t("admin.halls.unlock.badge.unpaidLocked")
      : access === "unlocked"
        ? t("admin.halls.unlock.badge.unlocked")
        : t("admin.halls.unlock.badge.adminLocked");

  return (
    <span
      className={`inline-flex max-w-full min-h-7 items-center rounded-full px-2.5 py-1 text-[0.7rem] font-bold leading-4 ${styles[access]}`}
      data-testid="admin-hall-lock-badge"
      data-access={access}
      role="status"
      aria-label={label}
    >
      {label}
    </span>
  );
}
