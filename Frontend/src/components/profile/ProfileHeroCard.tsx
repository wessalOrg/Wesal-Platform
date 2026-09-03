"use client";

import type { UserProfile } from "@/types/profile";
import { useT } from "@/i18n";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function ProfileHeroCard({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
}) {
  const t = useT();

  return (
    <section
      className="rounded-3xl border border-[var(--wesal-maroon)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(90,55,45,0.06)] sm:p-6"
      data-testid="profile-page"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--wesal-maroon)]/35 bg-[var(--wesal-pink)] text-2xl font-bold text-[var(--wesal-maroon)] sm:h-28 sm:w-28"
            aria-hidden="true"
          >
            {initials(profile.fullName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <h1 className="truncate text-2xl font-extrabold text-[var(--wesal-maroon)] sm:text-3xl">
                {profile.fullName}
              </h1>
              <button
                type="button"
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)]"
                aria-label={t("profile.edit")}
                data-testid="profile-edit-open"
                onClick={onEdit}
              >
                <PencilIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--wesal-border)] pt-5 text-sm sm:grid-cols-2">
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
    <div className="min-w-0">
      <p className="text-xs font-medium text-[var(--wesal-muted)]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[var(--wesal-text)]" dir={dir}>
        {value || "—"}
      </p>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 16.8V20h3.2L18.7 8.5a1.8 1.8 0 0 0 0-2.5L17 4.3a1.8 1.8 0 0 0-2.5 0L4 14.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
