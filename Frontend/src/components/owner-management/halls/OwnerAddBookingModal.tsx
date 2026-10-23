"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLong, localTodayIso, parseDateIso } from "@/lib/booking-date";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { formatAmountMatchingInput, parseDepositAmount } from "@/lib/booking-deposits";
import { localizeHallName } from "@/lib/localize-hall-display";
import { saveExternalBooking } from "@/services/owner-external-bookings";
import { slotStartsBetween } from "@/lib/hourly-slots";
import { bookedHourRanges } from "@/lib/owner-bookings-calendar";
import { ApiError } from "@/lib/api-error";
import type { ExternalBooking, ExternalBookingInput } from "@/types/external-booking";
import type { HallOwnerHall } from "@/types/hall-owner-halls";
import type { OwnerManualEventType } from "@/types/owner-manual-booking";

const EVENT_TYPES: OwnerManualEventType[] = [
  "wedding",
  "engagement",
  "graduation",
  "birthday",
  "other",
];

function hour12Label(hour24: number, lang: "ar" | "en"): string {
  const period = hour24 < 12 ? (lang === "ar" ? "ص" : "AM") : lang === "ar" ? "م" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:00 ${period}`;
}

function buildTimeOptions(lang: "ar" | "en") {
  return Array.from({ length: 24 }, (_, hour) => {
    const value = `${String(hour).padStart(2, "0")}:00`;
    return { value, label: hour12Label(hour, lang) };
  });
}

function normalizeTimeValue(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "14:00";
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  return `${String(hour).padStart(2, "0")}:00`;
}

type OwnerAddBookingModalProps = {
  open: boolean;
  booking?: ExternalBooking;
  halls: HallOwnerHall[];
  defaultHallId: string;
  defaultDate?: string | null;
  onClose: () => void;
  onSaved?: (bookingId: string, hallId: string, date: string) => void;
};

type FormState = {
  hallId: string;
  eventType: OwnerManualEventType;
  customerName: string;
  phone: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  ranges: Array<{ start: string; end: string }> | null;
  guests: string;
  totalAmount: string;
  depositAmount: string;
  notes: string;
};

type Submission = { key: string; hallId: string; input: ExternalBookingInput; draft: FormState; existing?: ExternalBooking };

export default function OwnerAddBookingModal({
  open,
  booking,
  halls,
  defaultHallId,
  defaultDate = null,
  onClose,
  onSaved,
}: OwnerAddBookingModalProps) {
  const t = useT();
  const lang = useUiLang();
  const titleId = useId();
  const dateLocale = lang === "ar" ? "ar-EG" : "en-GB";
  const timeOptions = useMemo(() => buildTimeOptions(lang === "ar" ? "ar" : "en"), [lang]);
  const [recovery, setRecovery] = useState<Submission | null>(null);
  const inFlight = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>(() =>
    booking ? formFromBooking(booking) : emptyForm(defaultHallId, defaultDate),
  );
  const [wasOpen, setWasOpen] = useState(open);

  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setForm(recovery?.draft ?? (booking ? formFromBooking(booking) : emptyForm(defaultHallId || halls[0]?.id || "", defaultDate)));
      setErrors({});
      setSaving(false);
      setSaveError(null);
    }
  }

  const remaining = useMemo(() => {
    const total = parseDepositAmount(form.totalAmount);
    const deposit = parseDepositAmount(form.depositAmount);
    if (total == null) return null;
    return Math.max(0, total - (deposit ?? 0));
  }, [form.depositAmount, form.totalAmount]);

  const remainingLabel = useMemo(() => {
    if (remaining == null) return "—";
    return formatAmountMatchingInput(remaining, [form.totalAmount, form.depositAmount]);
  }, [form.depositAmount, form.totalAmount, remaining]);

  const dateDisplay = useMemo(() => {
    const iso = parseDateIso(form.date);
    return iso ? formatBookingDateLong(iso, dateLocale) : "";
  }, [dateLocale, form.date]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
    };
  }, [onClose, open, saving]);

  if (!open) return null;

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.hallId.trim()) next.hallId = t("owner.calendar.add.errors.hall");
    if (!form.customerName.trim()) next.customerName = t("owner.calendar.add.errors.customer");
    if (!form.phone.trim()) next.phone = t("owner.calendar.add.errors.phone");
    if (!parseDateIso(form.date)) next.date = t("owner.calendar.add.errors.date");
    if (!form.timeFrom.trim()) next.timeFrom = t("owner.calendar.add.errors.timeFrom");
    if (!form.timeTo.trim()) next.timeTo = t("owner.calendar.add.errors.timeTo");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (inFlight.current) return;
    if (!recovery && !validate()) return;
    const hall = halls.find((item) => item.id === form.hallId);
    if (!hall) {
      setErrors((current) => ({ ...current, hallId: t("owner.calendar.add.errors.hall") }));
      return;
    }

    const input: ExternalBookingInput = {
      customerName: form.customerName.trim(), phone: form.phone.trim(), eventType: form.eventType,
      date: parseDateIso(form.date) || form.date,
      slotStarts: [...new Set((form.ranges ?? [{ start: form.timeFrom, end: form.timeTo }])
        .flatMap(({ start, end }) => slotStartsBetween(start, end)).map((time) => time + ":00"))].sort(),
      guests: form.guests.trim() ? Number(form.guests) : null, notes: form.notes.trim(),
      totalAmount: parseDepositAmount(form.totalAmount), amountReceivedExternally: parseDepositAmount(form.depositAmount),
    };
    if (!recovery && (!input.slotStarts.length || form.ranges?.some(({ start, end }) => end <= start) || (form.totalAmount.trim() && input.totalAmount == null) ||
        (form.depositAmount.trim() && input.amountReceivedExternally == null) ||
        (input.guests != null && (!Number.isInteger(input.guests) || input.guests < 1)))) {
      setSaveError(t("owner.external.invalid")); return;
    }
    const attempt = recovery ?? { key: crypto.randomUUID(), hallId: hall.id, input, draft: form, existing: booking };
    inFlight.current = true;
    setSaving(true); setSaveError(null);
    try {
      const saved = await saveExternalBooking(attempt.hallId, attempt.input, attempt.key, attempt.existing);
      setRecovery(null);
      onSaved?.(saved.bookingId, saved.hallId, saved.date);
      onClose();
    } catch (error) {
      // After an uncertain result, only success or a rejection made AFTER receipt
      // lookup resolves the original operation. Authentication/network errors do not.
      const rejectedAfterReplay = error instanceof ApiError && ["RevisionRequired", "RevisionConflict", "ExternalBookingCancelled",
        "HallNotApproved", "SubscriptionExpired", "HourAlreadyStarted", "InvalidHallWindow", "InvalidHours", "InvalidLocalTime", "DayBlocked", "SlotUnavailable"].includes(error.code ?? "");
      const definitive = rejectedAfterReplay || (!recovery && error instanceof ApiError && error.status != null && error.status >= 400 && error.status < 500 && error.status !== 408);
      if (definitive) { setRecovery(null); }
      else { setRecovery(attempt); setForm(attempt.draft); }
      setSaveError(error instanceof ApiError && error.status === 412 ? t("owner.external.stale") :
        error instanceof ApiError && error.status === 409 ? t("owner.external.conflict") : t("owner.external.saveError"));
    } finally { inFlight.current = false; setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center sm:items-center sm:p-4"
      data-testid="owner-add-booking-overlay"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(60,40,35,0.35)]"
        aria-label={t("common.close")}
        disabled={saving}
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(94vh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_28px_80px_rgba(60,35,30,0.2)] sm:rounded-2xl"
        data-testid="owner-add-booking-modal"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--wesal-border)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="flex items-center gap-2 text-lg font-extrabold text-[var(--wesal-maroon)] sm:text-xl"
            >
              <AddCalendarIcon />
              {t(booking ? "owner.external.edit" : "owner.calendar.add.title")}
            </h2>
            <p className="mt-1 text-sm leading-7 text-[var(--wesal-muted)]">
              {t("owner.external.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink-soft)]"
            aria-label={t("common.close")}
            data-testid="owner-add-booking-close"
            disabled={saving}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        {recovery ? <p role="status" data-testid="owner-booking-recovery" className="shrink-0 px-4 py-3 text-sm text-amber-900 sm:px-6">
          {t("owner.external.recovery", { hall: localizeHallName(recovery.hallId, halls.find((hall) => hall.id === recovery.hallId)?.name ?? recovery.hallId, lang) })}
        </p> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
        <fieldset disabled={saving || Boolean(recovery)} className="min-w-0 border-0 px-4 py-4 sm:px-6 sm:py-5">
          {saveError ? <p role="alert" className="mb-3 text-sm text-red-700">{saveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("owner.calendar.add.hall")} required error={errors.hallId}>
              <SiteSelect
                value={form.hallId}
                icon={<HallIcon />}
                testId="owner-add-booking-hall"
                options={halls.filter((hall) => !booking || hall.id === booking.hallId).map((hall) => ({
                  value: hall.id,
                  label: localizeHallName(hall.id, hall.name, lang),
                }))}
                onChange={(value) => patch("hallId", value)}
              />
            </Field>

            <Field label={t("owner.calendar.add.eventType")} required>
              <SiteSelect
                value={form.eventType}
                icon={<UserIcon />}
                testId="owner-add-booking-event-type"
                options={EVENT_TYPES.map((type) => ({
                  value: type,
                  label: t(`owner.calendar.add.event.${type}`),
                }))}
                onChange={(value) => patch("eventType", value as OwnerManualEventType)}
              />
            </Field>

            <Field
              label={t("owner.calendar.add.customer")}
              required
              error={errors.customerName}
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-maroon)]">
                  <UserIcon />
                </span>
                <input
                  className={inputClass(true)}
                  value={form.customerName}
                  placeholder={t("owner.calendar.add.customerPlaceholder")}
                  data-testid="owner-add-booking-customer"
                  onChange={(event) => patch("customerName", event.target.value)}
                />
              </div>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={t("owner.calendar.add.guests")}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-maroon)]">
                  <GuestsIcon />
                </span>
                <input
                  className={inputClass(true)}
                  inputMode="numeric"
                  value={form.guests}
                  placeholder="250"
                  data-testid="owner-add-booking-guests"
                  onChange={(event) => patch("guests", event.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
            </Field>

            <Field label={t("owner.calendar.add.phone")} required error={errors.phone}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-maroon)]">
                  <PhoneIcon />
                </span>
                <input
                  className={inputClass(true)}
                  dir="ltr"
                  value={form.phone}
                  placeholder="0591234567"
                  inputMode="tel"
                  data-testid="owner-add-booking-phone"
                  onChange={(event) => patch("phone", event.target.value)}
                />
              </div>
            </Field>
          </div>

          <div className="mt-3 grid items-start gap-3 sm:grid-cols-3">
            <Field label={t("owner.calendar.add.date")} required error={errors.date}>
              <SiteDatePicker
                value={form.date}
                displayLabel={dateDisplay}
                locale={dateLocale}
                testId="owner-add-booking-date"
                onChange={(value) => patch("date", value)}
              />
            </Field>

            {form.ranges ? <div className="space-y-2 sm:col-span-2" data-testid="owner-edit-booking-ranges">
              <p className="text-sm font-bold">{t("owner.external.hours")}</p>
              {form.ranges.map((range, index) => <div key={index} className="flex items-end gap-2">
                <Field label={t("owner.calendar.add.timeFrom")} required>
                  <SiteSelect value={range.start} icon={<ClockIcon />} testId={`owner-edit-booking-range-from-${index}`} options={timeOptions}
                    onChange={(start) => patch("ranges", form.ranges!.map((item, i) => i === index ? { ...item, start } : item))} />
                </Field>
                <Field label={t("owner.calendar.add.timeTo")} required>
                  <SiteSelect value={range.end} icon={<ClockIcon />} testId={`owner-edit-booking-range-to-${index}`} options={timeOptions}
                    onChange={(end) => patch("ranges", form.ranges!.map((item, i) => i === index ? { ...item, end } : item))} />
                </Field>
                <button type="button" className="btn-outline min-h-10 px-2 text-xs" disabled={form.ranges!.length === 1}
                  onClick={() => patch("ranges", form.ranges!.filter((_, i) => i !== index))}>{t("owner.external.removeInterval")}</button>
              </div>)}
              <button type="button" className="btn-outline min-h-10 px-3 text-xs" onClick={() => patch("ranges", [...form.ranges!, { start: "14:00", end: "15:00" }])}>{t("owner.external.addInterval")}</button>
            </div> : <><Field
              label={t("owner.calendar.add.timeFrom")}
              required
              error={errors.timeFrom}
            >
              <SiteSelect
                value={normalizeTimeValue(form.timeFrom)}
                icon={<ClockIcon />}
                testId="owner-add-booking-time-from"
                options={timeOptions}
                onChange={(value) => patch("timeFrom", value)}
              />
            </Field>

            <Field label={t("owner.calendar.add.timeTo")} required error={errors.timeTo}>
              <SiteSelect
                value={normalizeTimeValue(form.timeTo)}
                icon={<ClockIcon />}
                testId="owner-add-booking-time-to"
                options={timeOptions}
                onChange={(value) => patch("timeTo", value)}
              />
            </Field>
            </>}
          </div>

          <section className="mt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--wesal-text)]">
              <CardIcon />
              {t("owner.calendar.add.paymentTitle")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <MoneyField
                label={t("owner.calendar.money.total")}
                value={form.totalAmount}
                onChange={(value) => patch("totalAmount", value)}
                testId="owner-add-booking-total"
              />
              <MoneyField
                label={t("owner.external.amountReceived")}
                value={form.depositAmount}
                onChange={(value) => patch("depositAmount", value)}
                testId="owner-add-booking-deposit"
              />
              <div>
                <p className="mb-1.5 text-[0.78rem] font-semibold text-[var(--wesal-text)]">
                  {t("owner.calendar.money.remaining")}
                </p>
                <div
                  className={`relative min-h-11 rounded-xl border text-sm font-extrabold ${
                    remaining != null && remaining > 0
                      ? "border-[#f0c9c7] bg-[#fff1f0] text-[#c0392b]"
                      : "border-[var(--wesal-border)] bg-white text-[var(--wesal-text)]"
                  }`}
                  data-testid="owner-add-booking-remaining"
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm font-bold"
                    aria-hidden="true"
                  >
                    ₪
                  </span>
                  <span
                    dir="ltr"
                    className="flex min-h-11 items-center justify-end pe-10 ps-3"
                  >
                    {remainingLabel}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--wesal-text)]">
              <NotesIcon />
              {t("owner.calendar.add.notesTitle")}
            </h3>
            <textarea
              className="min-h-24 w-full resize-y rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm text-[var(--wesal-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
              value={form.notes}
              placeholder={t("owner.calendar.add.notesPlaceholder")}
              data-testid="owner-add-booking-notes"
              onChange={(event) => patch("notes", event.target.value)}
            />
          </section>
        </fieldset>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--wesal-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            className="btn-outline min-h-11 w-full sm:w-auto sm:min-w-[8rem]"
            disabled={saving}
            onClick={onClose}
          >
            {t("owner.notifications.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[12rem]"
            disabled={saving}
            aria-busy={saving || undefined}
            data-testid="owner-add-booking-save"
            onClick={() => void handleSave()}
          >
            <PlusIcon />
            {saving ? t("owner.calendar.add.saving") : t(recovery ? "owner.external.retry" : "owner.calendar.add.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formFromBooking(b: ExternalBooking): FormState {
  const ranges = bookedHourRanges(b.slotStarts);
  return { hallId: b.hallId, eventType: b.eventType, customerName: b.customerName, phone: b.phone,
    date: b.date, timeFrom: ranges[0]?.start ?? "09:00", timeTo: ranges[0]?.end ?? "10:00", ranges, guests: b.guests?.toString() ?? "",
    totalAmount: b.totalAmount?.toString() ?? "", depositAmount: b.amountReceivedExternally?.toString() ?? "", notes: b.notes };
}

function emptyForm(hallId: string, defaultDate: string | null): FormState {
  return {
    hallId,
    eventType: "wedding",
    customerName: "",
    phone: "",
    date: parseDateIso(defaultDate) || localTodayIso(),
    timeFrom: "14:00",
    timeTo: "18:00",
    ranges: null,
    guests: "",
    totalAmount: "",
    depositAmount: "",
    notes: "",
  };
}

function Field({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-[var(--wesal-text)]">
        {label}
        {required ? <span className="text-[#c0392b]">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[0.72rem] text-[#b42318]">{error}</span> : null}
    </div>
  );
}

function SiteSelect({
  value,
  options,
  icon,
  onChange,
  testId,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  icon: ReactNode;
  onChange: (value: string) => void;
  testId: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-white pe-3 ps-3 text-start text-sm font-semibold text-[var(--wesal-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="inline-flex shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
        <SelectChevron open={open} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_32px_rgba(90,55,45,0.14)]"
          data-testid={`${testId}-menu`}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="presentation">
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
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function SelectChevron({ open }: { open: boolean }) {
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

function SiteDatePicker({
  value,
  displayLabel,
  locale,
  onChange,
  testId,
}: {
  value: string;
  displayLabel: string;
  locale: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseDateIso(value);
  const today = localTodayIso();
  const initial = selected ?? today;
  const [cursor, setCursor] = useState(() => {
    const [year, month] = initial.split("-").map(Number);
    return { year, month: month - 1 };
  });

  useEffect(() => {
    if (!open) return;
    const iso = selected ?? today;
    const [year, month] = iso.split("-").map(Number);
    setCursor({ year, month: month - 1 });
  }, [open, selected, today]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const weekdays = useMemo(() => {
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + index);
      return date.toLocaleDateString(locale, { weekday: "narrow" });
    });
  }, [locale]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: Array<{ key: string; dayNum: number | null; iso: string | null }> = [];
    for (let i = 0; i < startPad; i += 1) {
      list.push({ key: `pad-${i}`, dayNum: null, iso: null });
    }
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      list.push({ key: iso, dayNum, iso });
    }
    while (list.length % 7 !== 0) {
      list.push({ key: `tail-${list.length}`, dayNum: null, iso: null });
    }
    return list;
  }, [cursor.month, cursor.year]);

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-white pe-3 ps-3 text-start text-sm font-semibold text-[var(--wesal-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="inline-flex shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
          <CalendarIcon />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {displayLabel || selected || t("owner.calendar.add.date")}
        </span>
        <SelectChevron open={open} />
      </button>

      {open ? (
        <div
          className="absolute z-40 mt-1.5 w-[min(100%,19rem)] rounded-2xl border border-[var(--wesal-border)] bg-white p-3 shadow-[0_16px_40px_rgba(90,55,45,0.16)]"
          data-testid={`${testId}-calendar`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--wesal-text)]">{monthLabel}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)]"
                aria-label={t("halls.booking.prevMonth")}
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)]"
                aria-label={t("halls.booking.nextMonth")}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-[var(--wesal-muted)]">
            {weekdays.map((label, index) => (
              <div key={`${label}-${index}`} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (!cell.iso || cell.dayNum == null) {
                return <div key={cell.key} className="min-h-9" />;
              }
              const isSelected = cell.iso === selected;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`inline-flex min-h-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    isSelected
                      ? "bg-[var(--wesal-maroon)] text-white shadow-[0_6px_14px_rgba(193,123,127,0.35)]"
                      : isToday
                        ? "bg-[var(--wesal-pink)] text-[var(--wesal-maroon-dark)]"
                        : "text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                  }`}
                  onClick={() => {
                    onChange(cell.iso!);
                    setOpen(false);
                  }}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--wesal-border)] pt-2">
            <button
              type="button"
              className="text-[0.78rem] font-bold text-[var(--wesal-maroon)] hover:underline"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              {t("owner.calendar.today")}
            </button>
            <button
              type="button"
              className="text-[0.78rem] font-bold text-[var(--wesal-muted)] hover:text-[var(--wesal-maroon)] hover:underline"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("home.consult.dateClear")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[0.78rem] font-semibold text-[var(--wesal-text)]">{label}</span>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 end-3 z-[1] flex items-center text-sm font-bold text-[var(--wesal-muted)]"
          aria-hidden="true"
        >
          ₪
        </span>
        <input
          className={`${inputClass(false)} pe-10 ps-3 text-end`}
          dir="ltr"
          inputMode="decimal"
          value={value}
          data-testid={testId}
          onChange={(event) =>
            onChange(event.target.value.replace(/[^\d.٠-٩]/g, ""))
          }
        />
      </div>
    </label>
  );
}

function inputClass(withIcon: boolean): string {
  return [
    "min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white text-sm font-semibold text-[var(--wesal-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]",
    withIcon ? "ps-10 pe-3" : "px-3",
  ].join(" ");
}

function AddCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 20V9.5L12 4l8 5.5V20" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 20v-6h5v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 18.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.8h2.1l1.1 3.2-1.4 1.1a12.4 12.4 0 0 0 4.9 4.9l1.1-1.4 3.2 1.1v2.1c0 .7-.5 1.3-1.2 1.4-6.9.9-12.7-4.9-11.8-11.8.1-.7.7-1.2 1.4-1.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.25v4.1l2.6 1.55" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.8 18c1.2-2.4 3-3.6 5.2-3.6s4 1.2 5.2 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 10h17M7 14h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <path d="M7 4.5h8.5L19 8v11.5H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15 4.5V8h3.5M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
