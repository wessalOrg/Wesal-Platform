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
      className={
        variant === "soft"
          ? "seeker-home-soft-btn gap-2"
          : "btn-outline inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 sm:w-auto sm:min-w-[8.5rem]"
      }
      data-testid="admin-hall-message"
      onClick={() => {
        openForHall({ hallId, hallName, ownerName });
      }}
    >
      <MessageIcon />
      {t("admin.halls.message.action")}
    </button>
  );
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M5 7h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 17H9.2L5 20v-2.5V8.5A1.5 1.5 0 0 1 5 7Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}
