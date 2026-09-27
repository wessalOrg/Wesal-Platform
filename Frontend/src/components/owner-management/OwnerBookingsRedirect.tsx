"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useT } from "@/i18n";
import { ownerHallNotificationsPath } from "@/lib/hall-owner-query-keys";
import { findHallIdForBookingRequest } from "@/lib/owner-booking-request-lookup";

/**
 * `/owner/bookings?request_id=` aliases the hall-scoped requests view.
 */
export default function OwnerBookingsRedirect() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hallId = searchParams.get("hallId")?.trim() || "";
  const requestId = searchParams.get("request_id")?.trim() || "";
  const { halls, isLoading, status } = useHallOwnerHalls();

  useEffect(() => {
    if (hallId) {
      router.replace(ownerHallNotificationsPath(hallId, requestId || null));
      return;
    }

    if (isLoading || status === "idle") return;

    if (halls.length === 0) {
      router.replace("/owner/halls");
      return;
    }

    if (!requestId) {
      router.replace(ownerHallNotificationsPath(halls[0].id));
      return;
    }

    let cancelled = false;
    void findHallIdForBookingRequest(
      halls.map((hall) => hall.id),
      requestId,
    ).then((foundHallId) => {
      if (cancelled) return;
      router.replace(ownerHallNotificationsPath(foundHallId ?? halls[0].id, requestId));
    });

    return () => {
      cancelled = true;
    };
  }, [hallId, halls, isLoading, requestId, router, status]);

  return (
    <section
      className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
      data-testid="owner-bookings-redirect"
      aria-busy="true"
    >
      <p className="text-sm text-[var(--wesal-muted)]">{t("owner.bookings.redirecting")}</p>
    </section>
  );
}
