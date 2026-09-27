import { Suspense } from "react";
import OwnerBookingsRedirect from "@/components/owner-management/OwnerBookingsRedirect";

export default function OwnerBookingsPage() {
  return (
    <Suspense
      fallback={
        <section className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
          <p className="text-sm text-[var(--wesal-muted)]">…</p>
        </section>
      }
    >
      <OwnerBookingsRedirect />
    </Suspense>
  );
}
