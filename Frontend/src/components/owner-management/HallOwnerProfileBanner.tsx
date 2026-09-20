"use client";

import Link from "next/link";
import { useHallOwnerManagementProfile } from "@/hooks/useHallOwnerManagementProfile";
import { useT } from "@/i18n";
import { HALL_OWNER_PROFILE_PATH } from "@/lib/account-profile-path";

/**
 * Completeness banner shown above the Add Hall form while the Hall Owner has not
 * yet uploaded the identity document required to create a hall (US-OWNER-30).
 */
export function HallOwnerProfileBanner() {
  const t = useT();
  const profileState = useHallOwnerManagementProfile();
  const pending =
    profileState.status === "ready" &&
    profileState.profile &&
    !profileState.profile.isIdentityDocumentUploaded;

  if (!pending) return null;

  return (
    <div
      className="mb-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-[#e2b93b]/40 bg-[#fdf6e3] p-4 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      data-testid="owner-add-hall-identity-banner"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--wesal-text)]">
          {t("owner.management.addHall.identityRequired")}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--wesal-muted)]">
          {t("owner.management.addHall.identityRequiredHint")}
        </p>
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