"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { cancelExternalBooking, getExternalBooking } from "@/services/owner-external-bookings";
import type { ExternalBooking } from "@/types/external-booking";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import OwnerAddBookingModal from "./OwnerAddBookingModal";

export default function ExternalBookingActions({ hallId, bookingId }: { hallId: string; bookingId: string }) {
  const t = useT();
  const [booking, setBooking] = useState<ExternalBooking | null>(null);
  const [mode, setMode] = useState<"edit" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const request = useRef<{ key: string; reason: string } | null>(null);
  const locked = useRef(false);

  async function open(next: "edit" | "cancel") {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { setBooking(await getExternalBooking(hallId, bookingId)); setMode(next); setReason(""); request.current = null; }
    catch { setError(t("owner.external.saveError")); }
    finally { locked.current = false; setBusy(false); }
  }

  async function cancel() {
    if (!booking || locked.current) return;
    if (request.current && request.current.reason !== reason) { setError(t("owner.external.retryOriginal")); return; }
    request.current ??= { key: crypto.randomUUID(), reason };
    locked.current = true; setBusy(true); setError(null);
    try { await cancelExternalBooking(booking, reason, request.current.key); setMode(null); }
    catch (e) {
      if (e instanceof ApiError && e.status && e.status >= 400 && e.status < 500) request.current = null;
      setError(t(e instanceof ApiError && e.status === 412 ? "owner.external.stale" : "owner.external.saveError"));
    } finally { locked.current = false; setBusy(false); }
  }

  return <div className="mt-3 space-y-2" data-testid="external-booking-actions">
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-outline min-h-10 px-3 text-xs" disabled={busy} onClick={() => void open("edit")}>{t("owner.external.edit")}</button>
      <button type="button" className="btn-outline min-h-10 px-3 text-xs text-red-700" disabled={busy} onClick={() => void open("cancel")}>{t("owner.external.cancel")}</button>
    </div>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {mode === "edit" && booking ? <EditDialog booking={booking} onClose={() => setMode(null)} /> : null}
    {mode === "cancel" && booking ? <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/30 p-4">
      <section role="dialog" aria-modal="true" aria-label={t("owner.external.cancel")} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p className="mb-3 font-semibold">{t("owner.external.confirmCancel")}</p>
        <label className="block text-sm">{t("owner.external.reason")}
          <textarea className="mt-2 w-full rounded-xl border p-2" maxLength={1000} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary min-h-10 px-3" disabled={busy} onClick={() => void cancel()}>{t("owner.external.cancel")}</button>
          <button className="btn-outline min-h-10 px-3" disabled={busy} onClick={() => setMode(null)}>{t("common.close")}</button>
        </div>
      </section>
    </div> : null}
  </div>;
}

function EditDialog({ booking, onClose }: { booking: ExternalBooking; onClose: () => void }) {
  const { halls, status } = useHallOwnerHalls();
  const t = useT();
  if (status === "error") return <p role="alert">{t("owner.external.saveError")}</p>;
  if (!halls.length) return <p role="status">{t("owner.calendar.loading")}</p>;
  return <OwnerAddBookingModal key={`${booking.bookingId}:${booking.revision}`} open booking={booking} halls={halls}
    defaultHallId={booking.hallId} onClose={onClose} />;
}
