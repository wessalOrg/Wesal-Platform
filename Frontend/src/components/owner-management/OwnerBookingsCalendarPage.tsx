"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiLang } from "@/components/layout/LanguageProvider";
import OwnerHallBookingsCalendar from "@/components/owner-management/halls/OwnerHallBookingsCalendar";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useT } from "@/i18n";
import { HALL_OWNER_CALENDAR_PATH } from "@/lib/account-profile-path";
import { localizeHallName } from "@/lib/localize-hall-display";

/**
 * Standalone Hall Owner bookings calendar (Edit 25).
 * Hall choice lives here. Month data, booked-day marks, and selected-day hours
 * stay in the shared OwnerHallBookingsCalendar feature (Edit 23).
 */
export default function OwnerBookingsCalendarPage() {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { halls, status, errorKey, refetch } = useHallOwnerHalls();
  const { startAddHall, isInitiating } = useAddHallInitiation();

  const requestedId = searchParams.get("hall")?.trim() ?? "";
  const selectedHall = halls.find((hall) => hall.id === requestedId) ?? halls[0] ?? null;
  const waiting = (status === "idle" || status === "loading") && halls.length === 0;
  const failed = status === "error" && halls.length === 0;
  const noHalls = status === "ready" && halls.length === 0;

  function selectHall(hallId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("hall", hallId);
    router.replace(`${HALL_OWNER_CALENDAR_PATH}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (status !== "ready" || !selectedHall) return;
    if (requestedId === selectedHall.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("hall", selectedHall.id);
    router.replace(`${HALL_OWNER_CALENDAR_PATH}?${params.toString()}`, { scroll: false });
  }, [requestedId, router, searchParams, selectedHall, status]);

  return (
    <div className="seeker-home min-w-0" data-testid="owner-bookings-calendar-page">
      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("owner.calendar.title")}</h1>
          <p className="seeker-welcome-body">{t("owner.calendar.pageSubtitle")}</p>
        </div>
      </section>

      {waiting ? (
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
          aria-busy="true"
          data-testid="owner-calendar-halls-loading"
        >
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("owner.calendar.hallsLoading")}</p>
        </section>
      ) : null}

      {failed ? (
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
          role="alert"
          data-testid="owner-calendar-halls-error"
        >
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">
            {t(errorKey ?? "owner.calendar.error")}
          </p>
          <button
            type="button"
            className="btn-outline mt-4 inline-flex min-h-11 items-center px-4"
            onClick={() => refetch()}
          >
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {noHalls ? (
        <section
          className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white p-4 sm:p-6"
          data-testid="owner-calendar-no-halls"
        >
          <p className="text-sm font-semibold leading-7 text-[var(--wesal-text)]">
            {t("owner.calendar.noHalls")}
          </p>
          <button
            type="button"
            className="seeker-btn-primary mt-4"
            disabled={isInitiating}
            aria-busy={isInitiating || undefined}
            onClick={() => {
              if (!isInitiating) void startAddHall();
            }}
          >
            {isInitiating ? t("owner.management.addHall.starting") : t("owner.cta.addHall")}
          </button>
        </section>
      ) : null}

      {selectedHall ? (
        <section className="min-w-0 space-y-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
          {halls.length > 1 ? (
            <label className="block max-w-md" htmlFor="owner-calendar-hall">
              <span className="mb-2 block text-sm font-bold text-[var(--wesal-text)]">
                {t("owner.calendar.selectHall")}
              </span>
              <select
                id="owner-calendar-hall"
                className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm font-semibold text-[var(--wesal-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
                value={selectedHall.id}
                data-testid="owner-calendar-hall-select"
                onChange={(event) => selectHall(event.target.value)}
              >
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {localizeHallName(hall.id, hall.name, lang)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm font-bold text-[var(--wesal-text)]" data-testid="owner-calendar-hall-name">
              <span className="font-semibold text-[var(--wesal-muted)]">
                {t("owner.calendar.hallLabel")}:{" "}
              </span>
              {localizeHallName(selectedHall.id, selectedHall.name, lang)}
            </p>
          )}

          <OwnerHallBookingsCalendar
            key={selectedHall.id}
            hallId={selectedHall.id}
            enabled
            detailsTitle
          />
        </section>
      ) : null}
    </div>
  );
}
