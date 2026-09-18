"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutConfirmDialog from "@/components/auth/LogoutConfirmDialog";
import WesalLogo from "@/components/brand/WesalLogo";
import { ADMIN_MANAGEMENT_PATH, ADMIN_SUBSCRIPTIONS_PATH } from "@/lib/account-profile-path";
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
  const homeActive = pathname === ADMIN_MANAGEMENT_PATH || pathname.startsWith(`${ADMIN_MANAGEMENT_PATH}/halls`);
  const subscriptionsActive = pathname === ADMIN_SUBSCRIPTIONS_PATH || pathname.startsWith(`${ADMIN_SUBSCRIPTIONS_PATH}/`);

  return (
    <>
      <aside
        id={id}
        className={`seeker-dash-sidebar ${className}`.trim()}
        aria-label={t("admin.sidebarLabel")}
        data-testid="admin-management-sidebar"
      >
        <div className="seeker-dash-sidebar-brand">
          <WesalLogo className="h-11 w-auto" variant="brand" animated={false} />
          <div className="min-w-0">
            <p className="seeker-dash-sidebar-brand-name">{t("brand.name")}</p>
            <p className="seeker-dash-sidebar-brand-sub">{t("admin.role")}</p>
          </div>
        </div>

        <nav className="seeker-dash-sidebar-nav">
          <ul className="seeker-dash-sidebar-list">
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
                <span>{t("admin.nav.subscriptions")}</span>
              </Link>
            </li>
          </ul>

          <div className="seeker-dash-sidebar-footer">
            <button
              type="button"
              className="seeker-dash-sidebar-logout"
              data-testid="admin-nav-logout"
              disabled={isLoggingOut}
              onClick={() => setConfirmLogout(true)}
            >
              {t("admin.nav.logout")}
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
          void logout();
        }}
      />
    </>
  );
}
