"use client";

import { useEffect, useState } from "react";
import type { UserProfile } from "@/types/profile";
import { useT } from "@/i18n";
import { readProfileAvatar } from "@/lib/profile-avatar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function ProfileHeroCard({
  profile,
}: {
  profile: UserProfile;
}) {
  const t = useT();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(readProfileAvatar(profile.id));
    const onAvatar = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; dataUrl?: string | null }>).detail;
      if (!detail || detail.userId !== profile.id) return;
      setAvatarUrl(detail.dataUrl ?? null);
    };
    window.addEventListener("wesal:profile-avatar", onAvatar);
    return () => window.removeEventListener("wesal:profile-avatar", onAvatar);
  }, [profile.id]);

  return (
    <section className="seeker-profile-card" data-testid="profile-page">
      <div className="seeker-profile-card-top">
        <div className="seeker-profile-card-avatar-wrap">
          <div className="seeker-profile-card-avatar" aria-hidden="true">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL
              <img src={avatarUrl} alt="" className="seeker-profile-card-avatar-img" />
            ) : (
              <span>{initials(profile.fullName)}</span>
            )}
          </div>
        </div>

        <div className="seeker-profile-card-meta">
          <div className="seeker-profile-card-name-row">
            <h2 className="seeker-profile-card-name">{profile.fullName}</h2>
          </div>
          <p className="seeker-profile-card-member">
            <span className="seeker-profile-card-member-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            <span>{t("profile.memberSince", { year: "2023" })}</span>
          </p>
        </div>
      </div>

      <div className="seeker-profile-card-facts">
        <ProfileFact label={t("profile.phone")} value={profile.phoneNumber} dir="ltr" />
        <ProfileFact label={t("profile.email")} value={profile.email} dir="ltr" />
      </div>
    </section>
  );
}

function ProfileFact({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="seeker-profile-fact">
      <p className="seeker-profile-fact-label">{label}</p>
      <p className="seeker-profile-fact-value" dir={dir || "auto"}>
        {value || "—"}
      </p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M12 3.5 5.5 6v5.2c0 4.2 2.8 7.4 6.5 8.8 3.7-1.4 6.5-4.6 6.5-8.8V6L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m9.2 12.1 1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
