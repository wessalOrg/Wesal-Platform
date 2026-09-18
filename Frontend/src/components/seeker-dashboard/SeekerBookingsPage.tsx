"use client";

import UserBookingsList from "@/components/bookings/UserBookingsList";
import { useT } from "@/i18n";

export default function SeekerBookingsPage() {
  const t = useT();

  return (
    <div data-testid="seeker-bookings-page">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-[var(--wesal-maroon)]">
          {t("seeker.nav.bookings")}
        </h1>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("seeker.bookingsSubtitle")}</p>
      </header>
      <UserBookingsList />
    </div>
  );
}
