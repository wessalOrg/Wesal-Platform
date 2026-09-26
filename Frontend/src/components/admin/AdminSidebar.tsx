"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutConfirmDialog from "@/components/auth/LogoutConfirmDialog";
import WesalLogo from "@/components/brand/WesalLogo";
import {
  ADMIN_MANAGEMENT_PATH,
  ADMIN_MESSAGES_PATH,
  ADMIN_SUBSCRIPTIONS_PATH,
} from "@/lib/account-profile-path";
import { useT } from "@/i18n";

type AdminSidebarProps = {
  id?: string;
  className?: string;
  onNavigate?: () => void;
};

export default function AdminSidebar({
  id,
  className = "",
  onNavigate,
}: AdminSidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isLoggingOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const homeActive =
    pathname === ADMIN_MANAGEMENT_PATH || pathname.startsWith(`${ADMIN_MANAGEMENT_PATH}/halls`);
  const subscriptionsActive =
    pathname === ADMIN_SUBSCRIPTIONS_PATH || pathname.startsWith(`${ADMIN_SUBSCRIPTIONS_PATH}/`);
  const messagesActive =
    pathname === ADMIN_MESSAGES_PATH || pathname.startsWith(`${ADMIN_MESSAGES_PATH}/`);

  return (
    <>
      <aside
        id={id}
        className={`seeker-dash-sidebar ${className}`.trim()}
        aria-label={t("admin.sidebarLabel")}
        data-testid="admin-management-sidebar"
      >
        <div className="seeker-dash-sidebar-brand">
          <WesalLogo className="h-11 w-auto" variant="brand" />
          <div className="min-w-0">
            <p className="seeker-dash-sidebar-brand-name">{t("brand.name")}</p>
            <p className="seeker-dash-sidebar-brand-sub">{t("admin.role")}</p>
          </div>
        </div>

        <nav className="seeker-dash-sidebar-nav">
          <ul className="seeker-dash-sidebar-list seeker-dash-sidebar-list--static">
            <li>
              <Link
                href={ADMIN_MANAGEMENT_PATH}
                prefetch
                className={`seeker-dash-sidebar-link${
                  homeActive ? " seeker-dash-sidebar-link--active" : ""
                }`}
                aria-current={homeActive ? "page" : undefined}
                data-testid="admin-nav-submissions"
                onClick={onNavigate}
                onMouseEnter={() => router.prefetch(ADMIN_MANAGEMENT_PATH)}
              >
                <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                  <SubmissionsIcon />
                </span>
                <span>{t("admin.nav.submissions")}</span>
              </Link>
            </li>
            <li>
              <Link
                href={ADMIN_SUBSCRIPTIONS_PATH}
                prefetch
                className={`seeker-dash-sidebar-link${
                  subscriptionsActive ? " seeker-dash-sidebar-link--active" : ""
                }`}
                aria-current={subscriptionsActive ? "page" : undefined}
                data-testid="admin-nav-subscriptions"
                onClick={onNavigate}
                onMouseEnter={() => router.prefetch(ADMIN_SUBSCRIPTIONS_PATH)}
              >
                <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                  <SubscriptionsIcon />
                </span>
                <span>{t("admin.nav.subscriptions")}</span>
              </Link>
            </li>
            <li>
              <Link
                href={ADMIN_MESSAGES_PATH}
                prefetch
                className={`seeker-dash-sidebar-link${
                  messagesActive ? " seeker-dash-sidebar-link--active" : ""
                }`}
                aria-current={messagesActive ? "page" : undefined}
                data-testid="admin-nav-messages"
                onClick={onNavigate}
                onMouseEnter={() => router.prefetch(ADMIN_MESSAGES_PATH)}
              >
                <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                  <MessagesIcon />
                </span>
                <span>{t("admin.nav.messages")}</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="seeker-dash-sidebar-footer">
          <button
            type="button"
            className="seeker-dash-sidebar-logout"
            data-testid="admin-nav-logout"
            disabled={isLoggingOut}
            onClick={() => setConfirmLogout(true)}
          >
            <span className="seeker-dash-sidebar-icon" aria-hidden="true">
              <LogoutIcon />
            </span>
            <span>{t("admin.nav.logout")}</span>
          </button>
        </div>
      </aside>

      <LogoutConfirmDialog
        open={confirmLogout}
        busy={isLoggingOut}
        onClose={() => {
          if (!isLoggingOut) setConfirmLogout(false);
        }}
        onConfirm={() => {
          setConfirmLogout(false);
          onNavigate?.();
          void logout();
        }}
      />
    </>
  );
}

function SubmissionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SubscriptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 14h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <path
        d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V16.5H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 16l4-4-4-4M18 12H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
