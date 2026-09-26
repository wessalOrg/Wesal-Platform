"use client";

import { useT } from "@/i18n";
import type { AdminMessageCategory } from "@/types/admin-messages";

type AdminMessageTypeBadgeProps = {
  category: AdminMessageCategory;
  className?: string;
};

export default function AdminMessageTypeBadge({
  category,
  className = "",
}: AdminMessageTypeBadgeProps) {
  const t = useT();
  const payment = category === "payment_notice";

  return (
    <span
      className={`inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[0.65rem] font-semibold ${
        payment
          ? "bg-[#f3d6d8] text-[#8b3a3f]"
          : "bg-[#ececec] text-[#6b6b6b]"
      } ${className}`.trim()}
      data-testid="admin-message-type-badge"
      data-category={category}
    >
      {payment
        ? t("admin.messages.badge.paymentNotice")
        : t("admin.messages.badge.conversation")}
    </span>
  );
}
