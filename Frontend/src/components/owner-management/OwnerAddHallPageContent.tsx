"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { OWNER_HALLS_PATH } from "@/constants/hallOwnerManagementNav";
import { useT } from "@/i18n";

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
 * US-OWNER-04 Add Hall destination — dashboard-aligned form shell.
 */
export default function OwnerAddHallPageContent() {
  const t = useT();

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

      <HallRegistrationForm />
    </div>
  );
}
