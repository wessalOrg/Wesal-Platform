"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import NavbarNotificationsButton from "@/components/layout/NavbarNotificationsButton";
import MobileSidebarTrigger from "@/components/owner-management/MobileSidebarTrigger";
import AdminOwnerMessagePanelHost from "@/components/admin/halls/AdminOwnerMessagePanelHost";
import { AdminOwnerMessageProvider } from "@/components/admin/halls/AdminOwnerMessageProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { ADMIN_ACCOUNT_PATH } from "@/lib/account-profile-path";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { useT } from "@/i18n";
import Link from "next/link";

const SIDEBAR_ID = "admin-dash-sidebar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function AdminManagementShell({
  children,
}: {
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const identity = useUserIdentity();
  const account = useAccountAccess();
  const avatarUrl = useProfileAvatarUrl([account.userId]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsSidebarOpen(false);
  }

  useEffect(() => {
    if (!isSidebarOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isSidebarOpen]);

  const displayName = identity.displayName || t("admin.guestName");

  return (
    <AdminOwnerMessageProvider>
      <div
        className={`seeker-dash${isSidebarOpen ? " seeker-dash--sidebar-open" : ""}`}
        data-testid="admin-management"
      >
      {isSidebarOpen ? (
        <button
          type="button"
          className="seeker-dash-drawer-backdrop"
          aria-label={t("common.close")}
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <AdminSidebar
        id={SIDEBAR_ID}
        className={isSidebarOpen ? "seeker-dash-sidebar--open" : ""}
        onNavigate={() => setIsSidebarOpen(false)}
      />

      <div className="seeker-dash-main">
        <header className="seeker-dash-topbar admin-dash-topbar">
          <p className="seeker-dash-topbar-title">{t("admin.appTitle")}</p>
          <div className="admin-dash-topbar-actions">
            <div className="seeker-dash-topbar-end admin-dash-topbar-tools">
              <NavbarNotificationsButton />
              <LanguageSwitcher iconOnly className="seeker-dash-lang" />
              <Link
                href={ADMIN_ACCOUNT_PATH}
                className="seeker-dash-userchip"
                data-testid="admin-topbar-account"
              >
                <span className="seeker-dash-userchip-avatar" aria-hidden="true">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local data URL avatar
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(displayName)
                  )}
                </span>
                <span className="seeker-dash-userchip-meta">
                  <span className="seeker-dash-userchip-name">{displayName}</span>
                  <span className="seeker-dash-userchip-role">{t("admin.role")}</span>
                </span>
              </Link>
            </div>
            <div className="admin-dash-topbar-menu md:hidden">
              <MobileSidebarTrigger
                compact
                isSidebarOpen={isSidebarOpen}
                sidebarId={SIDEBAR_ID}
                onOpen={() => setIsSidebarOpen(true)}
                onClose={() => setIsSidebarOpen(false)}
                openLabelKey="admin.openMenu"
                closeLabelKey="admin.closeMenu"
              />
            </div>
          </div>
        </header>

        <div className="seeker-dash-content">{children}</div>
      </div>
      </div>
      <AdminOwnerMessagePanelHost />
    </AdminOwnerMessageProvider>
  );
}
