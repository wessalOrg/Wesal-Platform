"use client";

import { useState } from "react";
import Link from "next/link";
import ProfileEditModal from "@/components/profile/ProfileEditForm";
import ProfileHeroCard from "@/components/profile/ProfileHeroCard";
import UserBookingsList from "@/components/bookings/UserBookingsList";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useT } from "@/i18n";

export default function ProfilePageView() {
  const t = useT();
  const profileState = useUserProfile();
  const [editing, setEditing] = useState(false);

  if (!profileState.authReady || profileState.status === "loading") {
    return (
      <div
        className="h-72 max-w-3xl animate-pulse rounded-3xl bg-white/80 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        aria-busy="true"
        data-testid="profile-loading"
      />
    );
  }

  if (profileState.status === "forbidden") {
    return (
      <section
        className="max-w-3xl rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="profile-owner-forbidden"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("profile.title")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("profile.ownerForbidden")}
        </p>
        <Link href="/" className="btn-outline mt-5">
          {t("common.backHome")}
        </Link>
      </section>
    );
  }

  if (profileState.status === "unauthorized") {
    return (
      <section
        className="max-w-3xl rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
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

  if (profileState.status === "error" || !profileState.profile) {
    return (
      <section
        className="max-w-3xl rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="profile-error"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("profile.title")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {profileState.loadError?.startsWith("errors.")
            ? t(profileState.loadError)
            : t("errors.profile.load")}
        </p>
        <button type="button" className="btn-outline mt-5" onClick={profileState.reload}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  return (
    <div className="max-w-3xl">
      <ProfileHeroCard
        profile={profileState.profile}
        onEdit={() => {
          profileState.clearFormFeedback();
          setEditing(true);
        }}
      />

      <UserBookingsList compact />

      <ProfileEditModal
        open={editing}
        profile={profileState.profile}
        saving={profileState.saving}
        fieldErrors={profileState.fieldErrors}
        formError={profileState.formError}
        onClose={() => {
          if (!profileState.saving) setEditing(false);
        }}
        onSave={profileState.save}
      />
    </div>
  );
}
