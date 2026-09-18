"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AudioControlToggle from "@/components/halls/notifications/AudioControlToggle";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import MobileSidebarTrigger from "@/components/owner-management/MobileSidebarTrigger";
import OwnerBookingNotificationsPopover from "@/components/owner-management/OwnerBookingNotificationsPopover";
import OwnerSidebar from "@/components/owner-management/OwnerSidebar";
import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import {
  HALL_OWNER_DASHBOARD_NAV,
  OWNER_ACCOUNT_PATH,
} from "@/constants/hallOwnerManagementNav";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { HALL_OWNER_ADD_HALL_PATH } from "@/lib/account-profile-path";
import { warmAddHallInitiation } from "@/lib/add-hall-initiation-cache";
import { readProfileAvatar } from "@/lib/profile-avatar";
import { useT } from "@/i18n";

const SIDEBAR_ID = "owner-dash-sidebar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

/**
 * Hall Owner workspace shell — same composition as the seeker dashboard,
 * with owner identity and hall-management navigation.
 */
export default function HallOwnerManagementShell({
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
    for (const item of HALL_OWNER_DASHBOARD_NAV) {
      router.prefetch(item.href);
    }
    router.prefetch(HALL_OWNER_ADD_HALL_PATH);
    void warmAddHallInitiation();
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
      const detail = (
        event as CustomEvent<{ userId?: string; dataUrl?: string | null }>
      ).detail;
      if (!detail || detail.userId !== userId) return;
      setAvatarUrl(detail.dataUrl ?? null);
    };
    window.addEventListener("wesal:profile-avatar", onAvatar);
    return () => window.removeEventListener("wesal:profile-avatar", onAvatar);
  }, [profileStore?.profile?.id]);

  const displayName =
    profileStore?.profile?.fullName ||
    identity.displayName ||
    t("owner.guestName");

  return (
    <div
      className={`seeker-dash${isSidebarOpen ? " seeker-dash--sidebar-open" : ""}`}
      data-testid="hall-owner-management"
    >
      {isSidebarOpen ? (
        <button
          type="button"
          className="seeker-dash-drawer-backdrop"
          aria-label={t("common.close")}
          data-testid="owner-management-drawer-backdrop"
          onClick={closeSidebar}
        />
      ) : null}

      <OwnerSidebar
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
              />
            </div>
            <div className="min-w-0">
              <p className="seeker-dash-topbar-title">{t("owner.appTitle")}</p>
            </div>
          </div>

          <div className="seeker-dash-topbar-end">
            <LanguageSwitcher iconOnly className="seeker-dash-lang" />
            <AudioControlToggle variant="nav" />
            <OwnerBookingNotificationsPopover />
            <Link href={OWNER_ACCOUNT_PATH} className="seeker-dash-userchip" prefetch>
              <span className="seeker-dash-userchip-avatar" aria-hidden="true">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL
                  <img
                    src={avatarUrl}
                    alt=""
                    className="seeker-dash-userchip-avatar-img"
                  />
                ) : (
                  initials(displayName)
                )}
              </span>
              <span className="seeker-dash-userchip-meta">
                <span className="seeker-dash-userchip-name">{displayName}</span>
                <span className="seeker-dash-userchip-role">{t("owner.role")}</span>
              </span>
            </Link>
          </div>
        </header>

        <div className="seeker-dash-content">{children}</div>
      </div>
    </div>
  );
}
