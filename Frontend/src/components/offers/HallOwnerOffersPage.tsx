"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HallOfferFormModal, {
  type HallOfferFormValues,
} from "@/components/offers/HallOfferFormModal";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import StopOfferConfirmDialog from "@/components/offers/StopOfferConfirmDialog";
import { useUiLang } from "@/components/layout/LanguageProvider";
import WesalSelect from "@/components/ui/WesalSelect";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { formatOfferDateRange, offerDateToIso } from "@/lib/offer-format";
import { offerDiscountPercent, resolveOfferStatus } from "@/lib/offer-status";
import { localizeHallName } from "@/lib/localize-hall-display";
import {
  createHallOffer,
  fetchOwnerHallOffers,
  stopHallOffer,
  updateHallOffer,
} from "@/services/hall-offers";
import type { HallOffer, OfferLifecycleStatus } from "@/types/offers";

type StatusFilter = "all" | OfferLifecycleStatus;

type OfferRow = HallOffer & { status: OfferLifecycleStatus };

export default function HallOwnerOffersPage() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const { halls, isLoading: hallsLoading } = useHallOwnerHalls();
  const approvedHalls = useMemo(
    () =>
      halls.filter(
        (hall) =>
          hall.status === "Approved" &&
          hall.paymentStatus === "Paid" &&
          !hall.adminLocked &&
          !hall.systemLocked,
      ),
    [halls],
  );

  const [selectedHallId, setSelectedHallId] = useState<string>("");
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<HallOffer | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stopTarget, setStopTarget] = useState<HallOffer | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedHallId && approvedHalls[0]) {
      setSelectedHallId(approvedHalls[0].id);
    }
  }, [approvedHalls, selectedHallId]);

  const loadOffers = useCallback(async (hallId: string) => {
    if (!hallId) {
      setOffers([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setErrorKey(null);
    try {
      const page = await fetchOwnerHallOffers(hallId, 1, 50);
      setOffers(
        page.items.map((item) => ({
          ...item,
          status: resolveOfferStatus(item.startsAt, item.endsAt, item.stoppedAt),
        })),
      );
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorKey(
        err instanceof ApiError ? err.message : "offers.errors.loadFailed",
      );
    }
  }, []);

  useEffect(() => {
    void loadOffers(selectedHallId);
  }, [loadOffers, selectedHallId]);

  const selectedHall = approvedHalls.find((hall) => hall.id === selectedHallId);
  const hallName = selectedHall
    ? localizeHallName(selectedHall.id, selectedHall.name, lang)
    : "";

  const counts = useMemo(() => {
    const active = offers.filter((o) => o.status === "active").length;
    const scheduled = offers.filter((o) => o.status === "scheduled").length;
    const expired = offers.filter(
      (o) => o.status === "expired" || o.status === "stopped",
    ).length;
    return { total: offers.length, active, scheduled, expired };
  }, [offers]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return offers.filter((offer) => {
      if (filter === "all") {
        /* keep */
      } else if (filter === "expired") {
        if (offer.status !== "expired" && offer.status !== "stopped") return false;
      } else if (offer.status !== filter) {
        return false;
      }
      if (!needle) return true;
      return (
        hallName.toLowerCase().includes(needle) ||
        String(offer.offerPrice).includes(needle)
      );
    });
  }, [filter, hallName, offers, query]);

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(offer: HallOffer) {
    setFormMode("edit");
    setEditing(offer);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: HallOfferFormValues) {
    if (!selectedHallId) return;
    setFormBusy(true);
    setFormError(null);
    const payload = {
      oldBookingPrice: Number(values.oldBookingPrice),
      offerPrice: Number(values.offerPrice),
      startsAt: offerDateToIso(values.startsAt, false),
      endsAt: offerDateToIso(values.endsAt, true),
    };
    try {
      if (formMode === "edit" && editing) {
        await updateHallOffer(selectedHallId, editing.id, payload);
      } else {
        await createHallOffer(selectedHallId, payload);
      }
      setFormOpen(false);
      await loadOffers(selectedHallId);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "offers.errors.saveFailed",
      );
    } finally {
      setFormBusy(false);
    }
  }

  async function handleStop() {
    if (!stopTarget || !selectedHallId) return;
    setStopBusy(true);
    setStopError(null);
    try {
      await stopHallOffer(selectedHallId, stopTarget.id);
      setStopTarget(null);
      await loadOffers(selectedHallId);
    } catch (err) {
      setStopError(
        err instanceof ApiError ? err.message : "offers.errors.stopFailed",
      );
    } finally {
      setStopBusy(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="owner-offers-page">
      <header className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_12%,white),var(--wesal-pink-soft))] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)]">
              {t("offers.owner.title")}
            </h1>
            <p className="mt-1 text-xs text-[var(--wesal-muted)]">
              {t("offers.owner.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary min-h-10 px-4"
            disabled={!selectedHallId || approvedHalls.length === 0}
            onClick={openCreate}
            data-testid="owner-offers-add"
          >
            + {t("offers.owner.add")}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("offers.owner.stats.total")} value={counts.total} />
        <StatCard label={t("offers.owner.stats.active")} value={counts.active} />
        <StatCard label={t("offers.owner.stats.scheduled")} value={counts.scheduled} />
        <StatCard label={t("offers.owner.stats.expired")} value={counts.expired} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-[12rem] sm:min-w-[16rem]">
          <WesalSelect
            label={t("offers.owner.hallSelect")}
            value={selectedHallId}
            disabled={hallsLoading || approvedHalls.length === 0}
            placeholder={t("offers.owner.noHalls")}
            options={approvedHalls.map((hall) => ({
              value: hall.id,
              label: localizeHallName(hall.id, hall.name, lang),
            }))}
            onChange={setSelectedHallId}
            testId="owner-offers-hall-select"
          />
        </div>
        <input
          type="search"
          className="wesal-input w-full sm:max-w-xs"
          placeholder={t("offers.owner.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", counts.total],
            ["active", counts.active],
            ["scheduled", counts.scheduled],
            ["expired", counts.expired],
          ] as const
        ).map(([key, count]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filter === key
                ? "bg-[var(--wesal-maroon)] text-white"
                : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)]"
            }`}
            onClick={() => setFilter(key)}
          >
            {t(`offers.filter.${key}`)} ({count})
          </button>
        ))}
      </div>

      {status === "loading" || hallsLoading ? (
        <p className="text-sm text-[var(--wesal-muted)]">{t("offers.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {errorKey?.startsWith("offers.") || errorKey?.startsWith("errors.")
            ? t(errorKey)
            : errorKey || t("offers.errors.loadFailed")}
        </p>
      ) : null}
      {status === "ready" && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white p-6 text-center text-sm text-[var(--wesal-muted)]">
          {t("offers.owner.empty")}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((offer) => {
          const discount = offerDiscountPercent(
            offer.oldBookingPrice,
            offer.offerPrice,
          );
          const dates = formatOfferDateRange(offer.startsAt, offer.endsAt, locale);
          const canEdit =
            offer.status === "active" || offer.status === "scheduled";
          return (
            <article
              key={offer.id}
              className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-sm"
              data-testid={`owner-offer-card-${offer.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <OfferStatusBadge status={offer.status} />
                  <h3 className="mt-2 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
                    {hallName}
                  </h3>
                  {discount != null ? (
                    <p className="mt-1 text-xs font-bold text-[var(--wesal-maroon)]">
                      {t("offers.discount", { percent: discount })}
                    </p>
                  ) : null}
                </div>
                <OfferPriceDisplay
                  oldPrice={offer.oldBookingPrice}
                  offerPrice={offer.offerPrice}
                  size="md"
                />
              </div>
              {dates ? (
                <p className="mt-3 text-xs text-[var(--wesal-muted)]">{dates}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {canEdit ? (
                  <button
                    type="button"
                    className="btn-primary min-h-9 px-3 text-xs"
                    onClick={() => openEdit(offer)}
                  >
                    {t("offers.actions.edit")}
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="btn-outline min-h-9 px-3 text-xs"
                    onClick={() => {
                      setStopError(null);
                      setStopTarget(offer);
                    }}
                  >
                    {offer.status === "scheduled"
                      ? t("offers.actions.cancelSchedule")
                      : t("offers.actions.stop")}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <HallOfferFormModal
        open={formOpen}
        mode={formMode}
        hallName={hallName}
        hallImageUrl={editing?.mainImageUrl}
        initial={editing}
        busy={formBusy}
        errorKey={formError}
        onClose={() => {
          if (!formBusy) setFormOpen(false);
        }}
        onSubmit={handleFormSubmit}
      />

      <StopOfferConfirmDialog
        open={Boolean(stopTarget)}
        busy={stopBusy}
        errorKey={stopError}
        onClose={() => {
          if (!stopBusy) setStopTarget(null);
        }}
        onConfirm={() => {
          void handleStop();
        }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--wesal-border)] bg-white p-3 shadow-sm">
      <p className="text-[0.7rem] font-bold text-[var(--wesal-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--wesal-maroon-dark)]">
        {value}
      </p>
    </div>
  );
}
