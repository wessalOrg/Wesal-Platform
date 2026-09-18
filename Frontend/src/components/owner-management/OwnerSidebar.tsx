"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutConfirmDialog from "@/components/auth/LogoutConfirmDialog";
import WesalLogo from "@/components/brand/WesalLogo";
import AddHallEntryAction from "@/components/owner-management/AddHallEntryAction";
import HallOwnerHallsSection from "@/components/owner-management/halls/HallOwnerHallsSection";
import {
  HALL_OWNER_DASHBOARD_NAV,
  isOwnerNavActive,
  type HallOwnerDashboardNavId,
} from "@/constants/hallOwnerManagementNav";
import { useT } from "@/i18n";

type OwnerSidebarProps = {
  id?: string;
  className?: string;
  onNavigate?: () => void;
};

export default function OwnerSidebar({
  id,
  className = "",
  onNavigate,
}: OwnerSidebarProps) {
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
        aria-label={t("owner.sidebarLabel")}
        data-testid="owner-management-sidebar"
      >
        <div className="seeker-dash-sidebar-brand">
          <WesalLogo className="h-11 w-auto" variant="brand" animated={false} />
          <div className="min-w-0">
            <p className="seeker-dash-sidebar-brand-name">{t("brand.name")}</p>
            <p className="seeker-dash-sidebar-brand-sub">{t("owner.role")}</p>
          </div>
        </div>

        <nav className="seeker-dash-sidebar-nav">
          <ul className="seeker-dash-sidebar-list !flex-none !overflow-visible">
            {HALL_OWNER_DASHBOARD_NAV.map((item) => {
              const active = isOwnerNavActive(pathname, item.href, item.match);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    prefetch
                    className={`seeker-dash-sidebar-link${
                      active ? " seeker-dash-sidebar-link--active" : ""
                    }`}
                    aria-current={active ? "page" : undefined}
                    data-testid={`owner-management-nav-${item.id}`}
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
            <li>
              <AddHallEntryAction />
            </li>
          </ul>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <HallOwnerHallsSection onNavigate={onNavigate} />
          </div>

          <div className="seeker-dash-sidebar-footer">
            <button
              type="button"
              className="seeker-dash-sidebar-logout"
              data-testid="owner-nav-logout"
              disabled={isLoggingOut}
              onClick={() => setConfirmLogout(true)}
            >
              <span className="seeker-dash-sidebar-icon" aria-hidden="true">
                <LogoutIcon />
              </span>
              <span>{t("owner.nav.logout")}</span>
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
          void logout(); // AuthProvider → landing `/`
        }}
      />
    </>
  );
}

function NavIcon({ id }: { id: HallOwnerDashboardNavId }) {
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
    case "halls":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
          <path
            d="M4 20V8.5L12 4l8 4.5V20"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
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
