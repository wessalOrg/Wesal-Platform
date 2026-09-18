"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import MobileSidebarTrigger from "@/components/owner-management/MobileSidebarTrigger";
import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import SeekerNotificationsPopover from "@/components/seeker-dashboard/SeekerNotificationsPopover";
import SeekerSidebar from "@/components/seeker-dashboard/SeekerSidebar";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { warmUserBookings } from "@/hooks/useUserBookings";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { readProfileAvatar } from "@/lib/profile-avatar";
import {
  SEEKER_ACCOUNT_PATH,
  SEEKER_DASHBOARD_NAV,
} from "@/constants/seekerDashboardNav";
import { useT } from "@/i18n";

const SIDEBAR_ID = "seeker-dash-sidebar";
const EXTRA_PREFETCH = ["/halls"] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

function scheduleIdle(task: () => void) {
  if (typeof window === "undefined") return;
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(task, { timeout: 1200 });
    return;
  }
  window.setTimeout(task, 120);
}

export default function SeekerDashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const identity = useUserIdentity();
  const profileStore = useOptionalUserProfileStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    for (const item of SEEKER_DASHBOARD_NAV) {
      router.prefetch(item.href);
    }
    scheduleIdle(() => {
      for (const href of EXTRA_PREFETCH) {
        router.prefetch(href);
      }
      warmUserBookings();
    });
  }, [router]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSidebarOpen]);

  useEffect(() => {
    const userId = profileStore?.profile?.id;
    if (!userId) {
      setAvatarUrl(null);
      return;
    }
    setAvatarUrl(readProfileAvatar(userId));

    const onAvatar = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; dataUrl?: string | null }>)
        .detail;
      if (!detail || detail.userId !== userId) return;
      setAvatarUrl(detail.dataUrl ?? null);
    };
    window.addEventListener("wesal:profile-avatar", onAvatar);
    return () => window.removeEventListener("wesal:profile-avatar", onAvatar);
  }, [profileStore?.profile?.id]);

  const displayName =
    profileStore?.profile?.fullName ||
    identity.displayName ||
    t("seeker.guestName");

  return (
    <div
      className={`seeker-dash${isSidebarOpen ? " seeker-dash--sidebar-open" : ""}`}
      data-testid="seeker-dashboard"
    >
      {isSidebarOpen ? (
        <button
          type="button"
          className="seeker-dash-drawer-backdrop"
          aria-label={t("common.close")}
          data-testid="seeker-dashboard-drawer-backdrop"
          onClick={closeSidebar}
        />
      ) : null}

      <SeekerSidebar
        id={SIDEBAR_ID}
        className={isSidebarOpen ? "seeker-dash-sidebar--open" : ""}
        onNavigate={closeSidebar}
      />

      <div className="seeker-dash-main">
        <header className="seeker-dash-topbar">
          <div className="seeker-dash-topbar-start">
            <div className="md:hidden">
              <MobileSidebarTrigger
                isSidebarOpen={isSidebarOpen}
                sidebarId={SIDEBAR_ID}
                onOpen={openSidebar}
                onClose={closeSidebar}
                openLabelKey="seeker.openMenu"
                closeLabelKey="seeker.closeMenu"
              />
            </div>
            <div className="min-w-0">
              <p className="seeker-dash-topbar-title">{t("seeker.appTitle")}</p>
            </div>
          </div>

          <div className="seeker-dash-topbar-end">
            <LanguageSwitcher iconOnly className="seeker-dash-lang" />
            <SeekerNotificationsPopover />
            <Link href={SEEKER_ACCOUNT_PATH} className="seeker-dash-userchip" prefetch>
              <span className="seeker-dash-userchip-avatar" aria-hidden="true">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL
                  <img src={avatarUrl} alt="" className="seeker-dash-userchip-avatar-img" />
                ) : (
                  initials(displayName)
                )}
              </span>
              <span className="seeker-dash-userchip-meta">
                <span className="seeker-dash-userchip-name">{displayName}</span>
                <span className="seeker-dash-userchip-role">{t("seeker.role")}</span>
              </span>
            </Link>
          </div>
        </header>

        <div className="seeker-dash-content">{children}</div>
      </div>
    </div>
  );
}
