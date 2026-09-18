"use client";

import Link from "next/link";
import HallNotificationsView from "@/components/halls/notifications/HallNotificationsView";
import OwnerAvailabilitySchedule from "@/components/halls/OwnerAvailabilitySchedule";
import HallManagementSectionNav from "@/components/owner-management/halls/HallManagementSectionNav";
import { useSelectedOwnerHall } from "@/hooks/useSelectedOwnerHall";
import { HALL_OWNER_PROFILE_PATH } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

type HallOwnerHallNotificationsViewProps = {
  hallId: string;
};

/**
 * Hall-scoped booking request Notifications (US-OWNER-09).
 * Accept/reject live in HallNotificationsView; publish/delete on the schedule.
 */
export default function HallOwnerHallNotificationsView({
  hallId,
}: HallOwnerHallNotificationsViewProps) {
  const t = useT();
  const { isListReady, isKnownOwnedHall, selectedHall } =
    useSelectedOwnerHall();

  if (isListReady && !isKnownOwnedHall) {
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        data-testid="owner-hall-notifications-unknown"
      >
        <p className="break-words text-sm text-[var(--wesal-muted)]">
          {t("owner.management.hallEdit.errors.notFound")}
        </p>
        <Link
          href={HALL_OWNER_PROFILE_PATH}
          className="btn-outline mt-4 inline-flex min-h-11 items-center"
        >
          {t("owner.management.nav.profile")}
        </Link>
      </section>
    );
  }

  const hallName = selectedHall?.name ?? "—";

  return (
    <section
      className="owner-hall-mgmt-panel owner-hall-notifications min-w-0 space-y-5 sm:space-y-6"
      data-testid="owner-hall-notifications-view"
      data-hall-id={hallId}
    >
      <header className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <div className="min-w-0 space-y-4">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-extrabold text-[var(--wesal-maroon)] sm:text-2xl">
              {hallName}
            </h2>
            <p className="mt-1 break-words text-sm text-[var(--wesal-muted)]">
              {t("owner.management.notifications.subtitle")}
            </p>
          </div>
          <HallManagementSectionNav hallId={hallId} />
        </div>
      </header>

      <div className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <div className="mb-4 min-w-0">
          <h3 className="break-words text-base font-extrabold text-[var(--wesal-maroon)]">
            {t("owner.management.notifications.title")}
          </h3>
        </div>
        <HallNotificationsView hallId={hallId} />
      </div>

      <div className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <OwnerAvailabilitySchedule hallId={hallId} hallName={hallName} />
      </div>
    </section>
  );
}
