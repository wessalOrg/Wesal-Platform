import { Suspense } from "react";
import OwnerBookingsCalendarPage from "@/components/owner-management/OwnerBookingsCalendarPage";

export default function OwnerCalendarPage() {
  return (
    <Suspense
      fallback={
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
          aria-busy="true"
          data-testid="owner-calendar-page-loading"
        >
          <p className="text-sm text-[var(--wesal-muted)]">…</p>
        </section>
      }
    >
      <OwnerBookingsCalendarPage />
    </Suspense>
  );
}
