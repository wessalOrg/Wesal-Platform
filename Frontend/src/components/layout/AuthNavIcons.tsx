"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";

type AuthNavIconsProps = {
  profileLabel: string;
  messagesLabel: string;
  onNavigate?: () => void;
  stacked?: boolean;
};

export default function AuthNavIcons({
  profileLabel,
  messagesLabel,
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
          href="/messages"
          className="flex min-h-11 items-center gap-2 py-2 text-sm font-medium text-[var(--wesal-text)]"
          onClick={openMessages}
        >
          <MessageIcon className="h-5 w-5 shrink-0 text-[var(--wesal-maroon)]" />
          {messagesLabel}
        </Link>
        <Link
          href="/profile"
          className="flex min-h-11 items-center gap-2 py-2 text-sm font-medium text-[var(--wesal-text)]"
          onClick={onNavigate}
        >
          <ProfileIcon className="h-5 w-5 shrink-0 text-[var(--wesal-maroon)]" />
          {profileLabel}
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      data-testid="navbar-auth-icons"
      aria-label={profileLabel}
    >
      <IconLink
        href="/messages"
        label={messagesLabel}
        active={pathname === "/messages" || pathname.startsWith("/messages/")}
        onNavigate={openMessages}
      >
        <MessageIcon className="h-5 w-5" />
      </IconLink>
      <IconLink
        href="/profile"
        label={profileLabel}
        active={pathname === "/profile" || pathname.startsWith("/profile/")}
        onNavigate={onNavigate}
      >
        <ProfileIcon className="h-5 w-5" />
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
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
        active
          ? "bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"
          : "text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink)]/70"
      }`}
    >
      {children}
    </Link>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.25c1.7-3.1 4.1-4.5 6.5-4.5s4.8 1.4 6.5 4.5" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 6.75h14a1.25 1.25 0 0 1 1.25 1.25v8a1.25 1.25 0 0 1-1.25 1.25H9.2L5 20.25v-3V8A1.25 1.25 0 0 1 5 6.75Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}
