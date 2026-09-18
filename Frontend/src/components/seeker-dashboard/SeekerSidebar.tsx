"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutConfirmDialog from "@/components/auth/LogoutConfirmDialog";
import WesalLogo from "@/components/brand/WesalLogo";
import {
  SEEKER_DASHBOARD_NAV,
  isSeekerNavActive,
  type SeekerDashboardNavId,
} from "@/constants/seekerDashboardNav";
import { useT } from "@/i18n";

type SeekerSidebarProps = {
  id?: string;
  className?: string;
  onNavigate?: () => void;
};

export default function SeekerSidebar({
  id,
  className = "",
  onNavigate,
}: SeekerSidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isLoggingOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <>
      <aside
        id={id}
        className={`seeker-dash-sidebar ${className}`.trim()}
        aria-label={t("seeker.sidebarLabel")}
        data-testid="seeker-dashboard-sidebar"
      >
        <div className="seeker-dash-sidebar-brand">
          <WesalLogo className="h-11 w-auto" variant="brand" animated={false} />
          <div className="min-w-0">
            <p className="seeker-dash-sidebar-brand-name">{t("brand.name")}</p>
            <p className="seeker-dash-sidebar-brand-sub">{t("seeker.role")}</p>
          </div>
        </div>

        <nav className="seeker-dash-sidebar-nav">
          <ul className="seeker-dash-sidebar-list">
            {SEEKER_DASHBOARD_NAV.map((item) => {
              const active = isSeekerNavActive(pathname, item.href, item.match);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    prefetch
                    className={`seeker-dash-sidebar-link${active ? " seeker-dash-sidebar-link--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    data-testid={`seeker-nav-${item.id}`}
                    onClick={onNavigate}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                  >
                    <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                      <NavIcon id={item.id} />
                    </span>
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="seeker-dash-sidebar-footer">
            <button
              type="button"
              className="seeker-dash-sidebar-logout"
              data-testid="seeker-nav-logout"
              disabled={isLoggingOut}
              onClick={() => setConfirmLogout(true)}
            >
              <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                <LogoutIcon />
              </span>
              <span>{t("seeker.nav.logout")}</span>
            </button>
          </div>
        </nav>
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

function NavIcon({ id }: { id: SeekerDashboardNavId }) {
  switch (id) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "account":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <circle cx="12" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M5.6 19c1.6-2.9 3.9-4.2 6.4-4.2s4.8 1.3 6.4 4.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bookings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <path
            d="M6.5 9.5a5.5 5.5 0 0 1 11 0v3.2l1.3 2.3H5.2l1.3-2.3V9.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
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
