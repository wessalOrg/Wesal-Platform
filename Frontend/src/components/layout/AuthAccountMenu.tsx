"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import LogoutConfirmDialog from "@/components/auth/LogoutConfirmDialog";
import AudioControlToggle from "@/components/halls/notifications/AudioControlToggle";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useT } from "@/i18n";
import {
  getAccountProfilePath,
  isAccountProfileActive,
} from "@/lib/account-profile-path";

type AuthAccountMenuProps = {
  stacked?: boolean;
  loggingOut?: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
};

function formatGreetingName(name: string | null | undefined, fallback: string) {
  const value = name?.trim();
  if (!value) return fallback;
  if (value.includes("@")) {
    const local = value.slice(0, value.indexOf("@")).trim();
    return local || fallback;
  }
  return value;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function AuthAccountMenu({
  stacked = false,
  loggingOut = false,
  onLogout,
  onNavigate,
}: AuthAccountMenuProps) {
  const t = useT();
  const pathname = usePathname();
  const { open, setOpen, close, toggle, rootRef, panelId: menuId } =
    useDismissibleOverlay();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const identity = useUserIdentity();
  const inbox = useOptionalMessagesInbox();
  const showAudio = identity.isHallOwner;
  const avatarUrl = useProfileAvatarUrl([identity.profile?.id]);

  const displayName = formatGreetingName(
    identity.displayName,
    t("nav.account"),
  );
  const hello = t("nav.hello");
  const profileLabel = t("nav.profile");
  const messagesLabel = t("nav.messages");
  const logoutLabel = t("nav.logout");
  const menuLabel = t("nav.accountMenu");
  const profileHref = getAccountProfilePath(identity.role);
  const profileActive = isAccountProfileActive(pathname, identity.role);

  const openMessages = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!inbox?.canUseMessaging) {
      close();
      onNavigate?.();
      return;
    }
    event.preventDefault();
    inbox.openInbox();
    close();
    onNavigate?.();
  };

  const go = () => {
    close();
    onNavigate?.();
  };

  const menu = (
    <div
      id={menuId}
      role="menu"
      aria-label={menuLabel}
      className={`wesal-account-menu ${
        stacked
          ? "relative mt-2 w-full"
          : "absolute end-0 top-[calc(100%+0.55rem)] z-50 w-[min(18.5rem,calc(100vw-1.25rem))]"
      }`}
      data-testid="navbar-account-menu"
    >
      <div className="wesal-account-menu-head" role="none">
        <span className="wesal-account-menu-head-avatar" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={avatarUrl} alt="" className="wesal-account-menu-head-avatar-img" />
          ) : (
            initials(displayName)
          )}
        </span>
        <div className="wesal-account-menu-head-copy">
          <p className="wesal-account-menu-head-name">{displayName}</p>
          <p className="wesal-account-menu-head-hello">{hello}</p>
        </div>
      </div>

      <div className="wesal-account-menu-list" role="none">
        <MenuLink
          href={profileHref}
          label={profileLabel}
          description={t("nav.profileHint")}
          active={profileActive}
          onClick={go}
        >
          <ProfileIcon />
        </MenuLink>
        <MenuLink
          href="/messages"
          label={messagesLabel}
          description={t("nav.messagesHint")}
          active={pathname === "/messages" || pathname.startsWith("/messages/")}
          onClick={openMessages}
        >
          <MessageIcon />
        </MenuLink>
        {showAudio ? <AudioControlToggle variant="menu" /> : null}
      </div>

      <div className="wesal-account-menu-footer" role="none">
        <button
          type="button"
          role="menuitem"
          className="wesal-account-menu-logout"
          disabled={loggingOut}
          aria-busy={loggingOut || undefined}
          data-testid="navbar-account-logout"
          onClick={() => {
            setOpen(false);
            setConfirmLogout(true);
          }}
        >
          <LogoutIcon />
          <span>{logoutLabel}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`relative flex min-w-0 items-center gap-2.5 ${stacked ? "w-full flex-col items-stretch" : ""}`}
      data-testid="navbar-authenticated"
    >
      <button
        type="button"
        className={`wesal-account-chip ${stacked ? "w-full" : ""}`}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="navbar-account-avatar"
        onClick={toggle}
      >
        <span className="wesal-account-avatar shrink-0" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={avatarUrl} alt="" className="wesal-account-avatar-img" />
          ) : (
            initials(displayName)
          )}
        </span>
        <span className={`wesal-account-chip-name ${stacked ? "flex-1" : ""}`}>
          {hello} {displayName}
        </span>
      </button>

      {open ? menu : null}

      <LogoutConfirmDialog
        open={confirmLogout}
        busy={loggingOut}
        onClose={() => {
          if (!loggingOut) setConfirmLogout(false);
        }}
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout();
        }}
      />
    </div>
  );
}

function MenuLink({
  href,
  label,
  description,
  active,
  onClick,
  children,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={`wesal-account-menu-item ${active ? "wesal-account-menu-item--active" : ""}`}
    >
      <span className="wesal-account-menu-icon" aria-hidden="true">
        {children}
      </span>
      <span className="wesal-account-menu-copy">
        <span className="wesal-account-menu-title">{label}</span>
        <span className="wesal-account-menu-desc">{description}</span>
      </span>
    </Link>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.1" />
      <path d="M5.6 19c1.6-2.9 3.9-4.2 6.4-4.2s4.8 1.3 6.4 4.2" />
    </svg>
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
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 7h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 17H9.2L5 20v-2.5V8.5A1.5 1.5 0 0 1 5 7Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 5H6.75A1.75 1.75 0 0 0 5 6.75v10.5A1.75 1.75 0 0 0 6.75 19H10"
        strokeLinecap="round"
      />
      <path
        d="M14 12h6.5M17.5 8.75 20.75 12 17.5 15.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
