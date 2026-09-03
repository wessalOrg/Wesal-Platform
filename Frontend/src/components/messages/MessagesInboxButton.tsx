"use client";

import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useT } from "@/i18n";

export default function MessagesInboxButton() {
  const t = useT();
  const { ready, authenticated } = useAccountAccess();
  const inbox = useOptionalMessagesInbox();

  if (!ready || !authenticated || !inbox?.canUseMessaging) return null;

  const { isOpen, toggleInbox } = inbox;

  return (
    <button
      type="button"
      className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-white text-[var(--wesal-maroon)] shadow-[0_4px_12px_rgba(193,123,127,0.2)] transition hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white hover:shadow-[0_10px_22px_rgba(193,123,127,0.28)] ${
        isOpen
          ? "border-[var(--wesal-maroon)] shadow-[0_6px_16px_rgba(193,123,127,0.32)]"
          : "border-[var(--wesal-maroon)]/45"
      }`}
      aria-label={t("nav.messages")}
      aria-expanded={isOpen}
      aria-controls="messages-inbox-panel"
      data-testid="navbar-messages"
      onClick={toggleInbox}
    >
      <MessagesIcon />
    </button>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M4.2 5.8h15.6A1.8 1.8 0 0 1 21.6 7.6v10.4a1.8 1.8 0 0 1-1.8 1.8H4.2a1.8 1.8 0 0 1-1.8-1.8V7.6a1.8 1.8 0 0 1 1.8-1.8Zm1.1 2.15 6.7 4.55 6.7-4.55v-.95L12 12.35 5.3 7v.95Z"
      />
    </svg>
  );
}
