"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";

type AuthNavIconsProps = {
  profileLabel: string;
  messagesLabel: string;
  notificationsLabel: string;
  onNavigate?: () => void;
  stacked?: boolean;
};

export default function AuthNavIcons({
  profileLabel,
  messagesLabel,
  notificationsLabel,
  onNavigate,
  stacked = false,
}: AuthNavIconsProps) {
  const pathname = usePathname();
  const inbox = useOptionalMessagesInbox();

  const openMessages = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!inbox?.canUseMessaging) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    inbox.openInbox();
    onNavigate?.();
  };

  if (stacked) {
    return (
      <div className="flex w-full flex-col gap-1" data-testid="navbar-auth-icons">
        <Link
          href="/profile"
          className="flex min-h-11 items-center gap-2.5 py-2 text-sm font-medium text-[var(--wesal-text)]"
          onClick={onNavigate}
        >
          <span className="wesal-auth-icon" aria-hidden="true">
            <ProfileIcon />
          </span>
          {profileLabel}
        </Link>
        <Link
          href="/notifications"
          className="flex min-h-11 items-center gap-2.5 py-2 text-sm font-medium text-[var(--wesal-text)]"
          onClick={onNavigate}
        >
          <span className="wesal-auth-icon" aria-hidden="true">
            <BellIcon />
          </span>
          {notificationsLabel}
        </Link>
        <Link
          href="/messages"
          className="flex min-h-11 items-center gap-2.5 py-2 text-sm font-medium text-[var(--wesal-text)]"
          onClick={openMessages}
        >
          <span className="wesal-auth-icon" aria-hidden="true">
            <MessageIcon />
          </span>
          {messagesLabel}
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      data-testid="navbar-auth-icons"
      aria-label={profileLabel}
      dir="ltr"
    >
      <IconLink
        href="/profile"
        label={profileLabel}
        active={pathname === "/profile" || pathname.startsWith("/profile/")}
        onNavigate={onNavigate}
      >
        <ProfileIcon />
      </IconLink>
      <IconLink
        href="/notifications"
        label={notificationsLabel}
        active={
          pathname === "/notifications" || pathname.startsWith("/notifications/")
        }
        onNavigate={onNavigate}
      >
        <BellIcon />
      </IconLink>
      <IconLink
        href="/messages"
        label={messagesLabel}
        active={pathname === "/messages" || pathname.startsWith("/messages/")}
        onNavigate={openMessages}
      >
        <MessageIcon />
      </IconLink>
    </div>
  );
}

function IconLink({
  href,
  label,
  active,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      onClick={onNavigate}
      className={`wesal-auth-icon ${active ? "wesal-auth-icon--active" : ""}`}
    >
      {children}
    </Link>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.15rem] w-[1.15rem]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9.2" r="2.6" />
      <path d="M7.6 17.2c1.35-2.15 2.95-3.1 4.4-3.1s3.05.95 4.4 3.1" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.15rem] w-[1.15rem]"
      aria-hidden="true"
    >
      <path d="M7.2 9.6a4.8 4.8 0 0 1 9.6 0c0 4.2 1.35 5.4 1.35 5.4H5.85S7.2 13.8 7.2 9.6Z" />
      <path d="M10.35 18.4a1.65 1.65 0 0 0 3.3 0" />
    </svg>
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
      className="h-[1.15rem] w-[1.15rem]"
      aria-hidden="true"
    >
      <path d="M12 4.75c4.55 0 8.25 2.95 8.25 6.6 0 3.65-3.7 6.6-8.25 6.6-.7 0-1.38-.06-2.02-.18L5.75 19.25l.9-2.55C5.55 15.55 3.75 13.7 3.75 11.35c0-3.65 3.7-6.6 8.25-6.6Z" />
      <circle cx="9.2" cy="11.35" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="11.35" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}
