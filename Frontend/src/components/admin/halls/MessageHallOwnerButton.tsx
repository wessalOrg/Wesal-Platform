"use client";

import { useAdminOwnerMessage } from "@/components/admin/halls/AdminOwnerMessageProvider";
import { useT } from "@/i18n";

type MessageHallOwnerButtonProps = {
  hallId: string;
  hallName: string;
  ownerName?: string | null;
  variant?: "soft" | "primary";
};

export default function MessageHallOwnerButton({
  hallId,
  hallName,
  ownerName,
  variant = "soft",
}: MessageHallOwnerButtonProps) {
  const t = useT();
  const { openForHall } = useAdminOwnerMessage();

  return (
    <button
      type="button"
      className={variant === "primary" ? "btn-primary min-h-11" : "seeker-home-soft-btn"}
      data-testid="admin-hall-message"
      onClick={() => {
        openForHall({ hallId, hallName, ownerName });
      }}
    >
      {t("admin.halls.message.action")}
    </button>
  );
}
