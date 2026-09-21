"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useHallOwnerManagementProfile } from "@/hooks/useHallOwnerManagementProfile";
import { HallOwnerProfileBanner } from "@/components/owner-management/HallOwnerProfileBanner";
import { OWNER_HALLS_PATH } from "@/constants/hallOwnerManagementNav";
import { useT } from "@/i18n";
import { HALL_OWNER_PROFILE_PATH } from "@/lib/account-profile-path";

const HallRegistrationForm = dynamic(
  () => import("@/components/owner-management/add-hall/HallRegistrationForm"),
  {
    ssr: false,
    loading: () => <AddHallFormFallback />,
  },
);

function AddHallFormFallback() {
  const t = useT();
  return (
    <div
      className="h-48 animate-pulse rounded-[1.35rem] bg-white/80"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">{t("owner.management.addHall.loadingForm")}</span>
    </div>
  );
}

/**
 * US-OWNER-30: A Hall Owner cannot create/submit a hall until the required
 * identity document is uploaded (backend is authoritative). This gate keeps the
 * creation form off-screen and guides the owner to complete their profile.
 */
function HallIdentityRequiredGate() {
  const t = useT();
  return (
    <div
      className="flex min-w-0 flex-col items-start gap-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6"
      role="status"
      data-testid="owner-add-hall-identity-gate"
    >
      <div className="flex min-w-0 gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6 text-[var(--wesal-maroon)]"
          >
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M5.4 19.5c1.7-3.1 4-4.5 6.6-4.5s4.9 1.4 6.6 4.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.management.addHall.identityRequired")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--wesal-muted)]">
            {t("owner.management.addHall.identityRequiredHint")}
          </p>
        </div>
      </div>
      <Link
        href={HALL_OWNER_PROFILE_PATH}
        className="btn-outline inline-flex min-h-11 w-full shrink-0 items-center justify-center sm:w-auto"
        prefetch
      >
        {t("owner.management.addHall.goToAccount")}
      </Link>
    </div>
  );
}

/**
 * US-OWNER-04 Add Hall destination — dashboard-aligned form shell.
 */
export default function OwnerAddHallPageContent() {
  const t = useT();
  const profileState = useHallOwnerManagementProfile();
  const profileReady = profileState.status === "ready";
  const identityMissing =
    profileReady && !!profileState.profile && !profileState.profile.isIdentityDocumentUploaded;
  const showFormFallback = !profileReady;

  return (
    <div
      className="seeker-settings seeker-account-page owner-add-hall-page"
      data-testid="owner-add-hall-panel"
    >
      <header className="seeker-settings-header flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 id="owner-add-hall-heading" className="seeker-settings-title">
            {t("owner.management.addHall.title")}
          </h1>
          <p className="seeker-settings-lead">
            {t("owner.management.addHall.subtitle")}
          </p>
        </div>
        <Link
          href={OWNER_HALLS_PATH}
          className="btn-outline inline-flex min-h-11 w-full shrink-0 items-center justify-center sm:w-auto"
          prefetch
        >
          {t("owner.nav.halls")}
        </Link>
      </header>

      {showFormFallback ? (
        <AddHallFormFallback />
      ) : identityMissing ? (
        <HallIdentityRequiredGate />
      ) : (
        <>
          <HallOwnerProfileBanner />
          <HallRegistrationForm />
        </>
      )}
    </div>
  );
}