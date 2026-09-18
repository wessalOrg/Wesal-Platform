"use client";

import { getHallApprovalStatusConfig } from "@/constants/hallApprovalStatus";
import { useT } from "@/i18n";
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";

type HallApprovalStatusBadgeProps = {
  status: HallApprovalStatus | string;
  className?: string;
};

export default function HallApprovalStatusBadge({
  status,
  className = "",
}: HallApprovalStatusBadgeProps) {
  const t = useT();
  const config = getHallApprovalStatusConfig(status);

  return (
    <span
      className={`owner-hall-status-badge owner-hall-status-badge--${config.tone} ${className}`.trim()}
      data-testid="owner-hall-status-badge"
      data-status={status}
    >
      {t(config.labelKey)}
    </span>
  );
}
