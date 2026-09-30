"use client";

import type { UserProfile } from "@/types/profile";
import { useT } from "@/i18n";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { memberSinceYear } from "@/lib/profile-mapper";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

type ProfileHeroCardProps = {
  profile?: UserProfile | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
};

export default function ProfileHeroCard({
  profile,
  fullName,
  email,
  phoneNumber,
  createdAt,
  avatarUrl: avatarUrlProp,
}: ProfileHeroCardProps) {
  const t = useT();
  const name = (fullName ?? profile?.fullName)?.trim() || "";
  const mail = (email ?? profile?.email)?.trim() || "";
  const phone = (phoneNumber ?? profile?.phoneNumber)?.trim() || "";
  const joined = memberSinceYear(createdAt ?? profile?.createdAt);
  const profileId = profile?.id ?? "";
  // Shared avatar store hook (profile id + session ids, live-updated on change).
  const sessionAvatar = useProfileAvatarUrl(profileId ? [profileId] : []);
  const storedAvatar = profileId ? sessionAvatar : null;

  const avatarUrl = avatarUrlProp || storedAvatar;

  return (
    <section className="seeker-profile-card" data-testid="profile-page">
      <div className="seeker-profile-card-top">
        <div className="seeker-profile-card-avatar-wrap">
          <div className="seeker-profile-card-avatar" aria-hidden="true">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL
              <img src={avatarUrl} alt="" className="seeker-profile-card-avatar-img" />
            ) : (
              <span>{initials(name)}</span>
            )}
          </div>
        </div>

        <div className="seeker-profile-card-meta">
          <div className="seeker-profile-card-name-row">
            <h2 className="seeker-profile-card-name">{name || t("profile.unspecified")}</h2>
          </div>
          {joined ? (
            <p className="seeker-profile-card-member">
              <span className="seeker-profile-card-member-icon" aria-hidden="true">
                <ShieldIcon />
              </span>
              <span>{t("profile.memberSince", { year: joined })}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="seeker-profile-card-facts">
        <ProfileFact label={t("profile.fullName")} value={name} />
        <ProfileFact label={t("profile.phone")} value={phone} dir="ltr" />
        <ProfileFact label={t("profile.email")} value={mail} dir="ltr" />
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
  const t = useT();
  const empty = !value.trim();
  return (
    <div className="seeker-profile-fact">
      <p className="seeker-profile-fact-label">{label}</p>
      <p
        className={`seeker-profile-fact-value ${empty ? "text-[var(--wesal-muted)]" : ""}`}
        dir={empty ? "auto" : dir || "auto"}
        data-empty={empty ? "true" : undefined}
      >
        {empty ? t("profile.unspecified") : value}
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
