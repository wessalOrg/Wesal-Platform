"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiLang } from "@/components/layout/LanguageProvider";
import OwnerAddBookingModal from "@/components/owner-management/halls/OwnerAddBookingModal";
import OwnerHallBookingsCalendar from "@/components/owner-management/halls/OwnerHallBookingsCalendar";
import SuccessToast from "@/components/ui/SuccessToast";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useT } from "@/i18n";
import { HALL_OWNER_CALENDAR_PATH } from "@/lib/account-profile-path";
import type { UiLang } from "@/lib/language";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { HallOwnerHall } from "@/types/hall-owner-halls";

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
  const [addOpen, setAddOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [focusDate, setFocusDate] = useState<string | null>(null);

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
        <div className="seeker-welcome-copy min-w-0">
          <h1 className="seeker-welcome-title">{t("owner.calendar.title")}</h1>
          <p className="seeker-welcome-body">{t("owner.calendar.pageSubtitle")}</p>
        </div>
        {selectedHall ? (
          <div className="w-full px-1">
            <button
              type="button"
              className="btn-primary inline-flex min-h-9 w-full items-center justify-center gap-2 px-3 text-center text-[0.72rem] sm:min-h-11 sm:text-sm"
              data-testid="owner-calendar-add-booking"
              onClick={() => setAddOpen(true)}
            >
              <PlusIcon />
              {t("owner.calendar.addBooking")}
            </button>
          </div>
        ) : null}
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
        <section className="min-w-0 space-y-4">
          {halls.length > 1 ? (
            <OwnerCalendarHallPicker
              halls={halls}
              selectedId={selectedHall.id}
              lang={lang}
              label={t("owner.calendar.selectHall")}
              onSelect={selectHall}
            />
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
            focusDate={focusDate}
          />
        </section>
      ) : null}

      {selectedHall ? (
        <OwnerAddBookingModal
          open={addOpen}
          halls={halls}
          defaultHallId={selectedHall.id}
          defaultDate={focusDate}
          onClose={() => setAddOpen(false)}
          onSaved={(_id, hallId, date) => {
            if (hallId !== selectedHall.id) selectHall(hallId);
            setFocusDate(date);
            setSavedToast(true);
          }}
        />
      ) : null}

      <SuccessToast
        open={savedToast}
        message={t("owner.calendar.add.saved")}
        onClose={() => setSavedToast(false)}
      />
    </div>
  );
}

function OwnerCalendarHallPicker({
  halls,
  selectedId,
  lang,
  label,
  onSelect,
}: {
  halls: HallOwnerHall[];
  selectedId: string;
  lang: UiLang;
  label: string;
  onSelect: (hallId: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = halls.find((hall) => hall.id === selectedId) ?? halls[0];
  const selectedLabel = selected
    ? localizeHallName(selected.id, selected.name, lang)
    : "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative block max-w-md" ref={rootRef}>
      <span id={`${listId}-label`} className="mb-2 block text-sm font-bold text-[var(--wesal-text)]">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm font-semibold text-[var(--wesal-text)] shadow-[0_4px_12px_rgba(90,55,45,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        aria-controls={listId}
        data-testid="owner-calendar-hall-select"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronIcon open={open} />
      </button>
      <AnchoredPanel
        as="ul"
        open={open}
        anchorRef={triggerRef}
        panelRef={panelRef}
        options={{ width: "anchor", estimateHeight: 280 }}
        id={listId}
        role="listbox"
        aria-labelledby={`${listId}-label`}
        className="m-0 list-none rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_32px_rgba(90,55,45,0.12)]"
        data-testid="owner-calendar-hall-menu"
      >
        {halls.map((hall) => {
          const active = hall.id === selectedId;
          const name = localizeHallName(hall.id, hall.name, lang);
          return (
            <li key={hall.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={`flex min-h-10 w-full items-center px-3 text-start text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--wesal-maroon)] text-white"
                    : "bg-white text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                }`}
                onClick={() => {
                  onSelect(hall.id);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          );
        })}
      </AnchoredPanel>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-[var(--wesal-maroon)] transition ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
