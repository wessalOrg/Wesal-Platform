"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import MobileSidebarTrigger from "@/components/owner-management/MobileSidebarTrigger";
import AdminOwnerMessagePanelHost from "@/components/admin/halls/AdminOwnerMessagePanelHost";
import { AdminOwnerMessageProvider } from "@/components/admin/halls/AdminOwnerMessageProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { useT } from "@/i18n";

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
        <header className="seeker-dash-topbar">
          <div className="seeker-dash-topbar-start">
            <div className="md:hidden">
              <MobileSidebarTrigger
                isSidebarOpen={isSidebarOpen}
                sidebarId={SIDEBAR_ID}
                onOpen={() => setIsSidebarOpen(true)}
                onClose={() => setIsSidebarOpen(false)}
                openLabelKey="admin.openMenu"
                closeLabelKey="admin.closeMenu"
              />
            </div>
            <p className="seeker-dash-topbar-title">{t("admin.appTitle")}</p>
          </div>

          <div className="seeker-dash-topbar-end">
            <LanguageSwitcher iconOnly className="seeker-dash-lang" />
            <span className="seeker-dash-userchip">
              <span className="seeker-dash-userchip-avatar" aria-hidden="true">
                {initials(displayName)}
              </span>
              <span className="seeker-dash-userchip-meta">
                <span className="seeker-dash-userchip-name">{displayName}</span>
                <span className="seeker-dash-userchip-role">{t("admin.role")}</span>
              </span>
            </span>
          </div>
        </header>

        <div className="seeker-dash-content">{children}</div>
      </div>
      </div>
      <AdminOwnerMessagePanelHost />
    </AdminOwnerMessageProvider>
  );
}
