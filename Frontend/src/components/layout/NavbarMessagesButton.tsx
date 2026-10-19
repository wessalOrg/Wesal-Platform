"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useT } from "@/i18n";
import { getAccountMessagesPath, isAccountMessagesActive } from "@/lib/account-profile-path";

type NavbarMessagesButtonProps = {
  onNavigate?: () => void;
};

/**
 * Navbar messages icon — sits beside the notifications bell for every signed-in role.
 * Opens the messages inbox panel (or the role's messages page when the panel is unavailable).
 */
export default function NavbarMessagesButton({ onNavigate }: NavbarMessagesButtonProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const identity = useUserIdentity();
  const inbox = useOptionalMessagesInbox();
  const { count, ready } = useUnreadCount();

  if (!identity.authenticated) return null;

  const href = getAccountMessagesPath(identity.role);
  const unread = ready ? count : 0;
  const active = Boolean(inbox?.isOpen) || isAccountMessagesActive(pathname, identity.role);

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate?.();
    if (inbox?.canUseMessaging) {
      inbox.openInbox();
      return;
    }
    router.push(href);
  };

  return (
    <div className="seeker-notify-wrap wesal-navbar-notify">
      <Link
        href={href}
        className={`seeker-dash-notify wesal-navbar-notify-btn${
          active ? " seeker-dash-notify--open" : ""
        }${unread > 0 ? " seeker-dash-notify--has-unread" : ""}`}
        aria-label={
          unread > 0
            ? `${t("nav.messages")} — ${t("messages.unreadCount", { count: unread })}`
            : t("nav.messages")
        }
        data-testid="navbar-messages-trigger"
        onClick={open}
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <MessageIcon />
        </span>
        {unread > 0 ? (
          <span
            className="seeker-notify-badge"
            aria-hidden="true"
            data-testid="navbar-messages-unread"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.2rem] w-[1.2rem]"
      aria-hidden="true"
    >
      <path d="M5 7h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 17H9.2L5 20v-2.5V8.5A1.5 1.5 0 0 1 5 7Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}
