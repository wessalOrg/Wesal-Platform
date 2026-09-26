"use client";

import { useT } from "@/i18n";

/** Owner-facing admin-lock notice for My Halls / management (Edit 16 mockup). */
export default function OwnerHallAdminLockedNotice() {
  const t = useT();

  return (
    <section
      className="rounded-2xl border border-[var(--wesal-maroon)]/20 bg-[#f8e9ea] px-4 py-3"
      role="status"
      data-testid="owner-hall-admin-locked-notice"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#c62828]"
          aria-hidden="true"
        >
          <LockIcon />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
            {t("owner.hallAccess.adminLocked.title")}
          </h3>
          <p className="mt-1 text-xs leading-6 text-[var(--wesal-text)]">
            {t("owner.hallAccess.adminLocked.body")}
          </p>
        </div>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
