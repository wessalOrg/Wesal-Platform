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
import { useHallOwnerManagementProfile } from "@/hooks/useHallOwnerManagementProfile";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { HALL_OWNER_ADD_HALL_PATH } from "@/lib/account-profile-path";
import { warmAddHallInitiation } from "@/lib/add-hall-initiation-cache";
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
  const avatarUrl = useProfileAvatarUrl([profileStore?.profile?.id]);
  const ownerProfileState = useHallOwnerManagementProfile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsSidebarOpen(false);
  }

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

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

  const displayName =
    profileStore?.profile?.fullName ||
    identity.displayName ||
    t("owner.guestName");

  const showProfileCompletionNotice =
    ownerProfileState.status === "ready" &&
    !!ownerProfileState.profile &&
    !ownerProfileState.profile.isIdentityDocumentUploaded;

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

        {showProfileCompletionNotice ? (
          <div className="px-4 pt-3 sm:px-6">
            <Link
              href={OWNER_ACCOUNT_PATH}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e2b93b]/50 bg-[#fdf6e3] px-4 py-3"
              data-testid="owner-profile-completion"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e2b93b]/20"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-[var(--wesal-maroon)]"
                >
                  <path
                    d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--wesal-text)]">
                  {t("owner.management.profileCompletion.message")}
                </span>
                <span className="block text-xs leading-5 text-[var(--wesal-muted)]">
                  {t("owner.management.profileCompletion.hint")}
                </span>
              </span>
              <span className="ms-auto shrink-0 text-sm font-semibold text-[var(--wesal-maroon)]">
                {t("owner.management.profileCompletion.action")}
              </span>
            </Link>
          </div>
        ) : null}

        <div className="seeker-dash-content">{children}</div>
      </div>
    </div>
  );
}
