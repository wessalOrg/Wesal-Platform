"use client";

import { useT } from "@/i18n";

type AdminChatBannerProps = {
  className?: string;
};

/** Visual isolation for the professional ↔ platform-admin conversation. */
export default function AdminChatBanner({ className = "" }: AdminChatBannerProps) {
  const t = useT();

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[var(--wesal-pink-soft)] px-3 py-2.5 ${className}`}
      data-testid="admin-chat-banner"
      role="note"
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-[0.7rem] font-bold text-white"
        aria-hidden="true"
      >
        و
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--wesal-maroon)]">{t("messages.adminChat.title")}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--wesal-muted)]">
          {t("messages.adminChat.hint")}
        </p>
      </div>
    </div>
  );
}
