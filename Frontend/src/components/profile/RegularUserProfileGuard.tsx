"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ProfileView from "@/components/profile/ProfileView";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useT } from "@/i18n";

export default function RegularUserProfileGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const { ready, authenticated, isHallOwner } = useUserIdentity();

  if (!ready) {
    return (
      <div
        className="h-72 max-w-xl animate-pulse rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        aria-busy="true"
        data-testid="profile-loading"
      />
    );
  }

  if (!authenticated) {
    return (
      <section
        className="max-w-xl rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="profile-unauthorized"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("profile.title")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">{t("profile.loginRequired")}</p>
        <Link href="/login?redirect=/profile" className="btn-primary mt-5">
          {t("profile.goLogin")}
        </Link>
      </section>
    );
  }

  if (isHallOwner) {
    return <ProfileView />;
  }

  return children;
}
