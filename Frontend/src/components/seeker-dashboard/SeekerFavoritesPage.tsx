"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import { localizeHallName, localizeLocation, localizePriceLabel } from "@/lib/localize-hall-display";
import {
  getServerSavedHallIds,
  readSavedHallIds,
  removeSavedHall,
  subscribeSavedHalls,
} from "@/lib/saved-halls";
import { fetchHallById } from "@/services/halls";
import type { HallDetails } from "@/types/hall";

type FavoriteRow =
  | { id: string; status: "ready"; hall: HallDetails }
  | { id: string; status: "missing" };

export default function SeekerFavoritesPage() {
  const t = useT();
  const lang = useUiLang();
  const savedIds = useSyncExternalStore(subscribeSavedHalls, readSavedHallIds, getServerSavedHallIds);
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(savedIds.length > 0);
  const idsKey = savedIds.join("\0");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("\0") : [];
    if (ids.length === 0) return;
    let active = true;
    void Promise.all(
      [...ids].reverse().map(async (id): Promise<FavoriteRow> => {
        const result = await fetchHallById(id);
        return result.status === "ok" ? { id, status: "ready", hall: result.hall } : { id, status: "missing" };
      }),
    ).then((next) => {
      if (!active) return;
      setRows(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [idsKey]);

  const visibleRows = rows.filter((row) => savedIds.includes(row.id));

  return (
    <div data-testid="seeker-favorites-page">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-[var(--wesal-maroon)]">{t("seeker.nav.favorites")}</h1>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("seeker.favoritesSubtitle")}</p>
      </header>

      {savedIds.length === 0 ? (
        <div className="rounded-2xl bg-white px-5 py-8 text-center" data-testid="seeker-favorites-empty">
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("seeker.favoritesEmpty")}</p>
          <Link href="/halls" className="btn-primary mt-5 inline-flex" prefetch>
            {t("seeker.browseHalls")}
          </Link>
        </div>
      ) : loading && visibleRows.length === 0 ? (
        <div className="h-28 animate-pulse rounded-2xl bg-white/80" aria-busy="true" />
      ) : (
        <ul className="grid gap-3">
          {visibleRows.map((row) =>
            row.status === "ready" ? (
              <FavoriteHallCard
                key={row.id}
                hall={row.hall}
                name={localizeHallName(row.hall.id, row.hall.name, lang)}
                location={localizeLocation(row.hall.location, lang)}
                price={localizePriceLabel(row.hall.priceLabel, lang)}
                onRemove={() => removeSavedHall(row.id)}
              />
            ) : (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4"
              >
                <p className="text-sm text-[var(--wesal-muted)]">{t("seeker.favorites.unavailable")}</p>
                <button type="button" className="btn-outline min-h-10" onClick={() => removeSavedHall(row.id)}>
                  {t("seeker.favorites.remove")}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function FavoriteHallCard({
  hall,
  name,
  location,
  price,
  onRemove,
}: {
  hall: HallDetails;
  name: string;
  location: string;
  price: string | null;
  onRemove: () => void;
}) {
  const t = useT();
  const image = hall.images[0];
  const capacity =
    hall.capacityMax != null
      ? t("common.peopleRange", { min: hall.capacity, max: hall.capacityMax })
      : t("common.peopleCount", { count: hall.capacity });

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_8px_22px_rgba(90,55,45,0.05)]">
      <Link
        href={buildHallDetailsPath(hall.id)}
        className="flex min-w-0 flex-1 items-center gap-3"
        data-testid={`seeker-favorite-${hall.id}`}
      >
        {image ? (
          <img
            src={image}
            alt=""
            width={88}
            height={72}
            className="h-[4.5rem] w-[5.5rem] shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="h-[4.5rem] w-[5.5rem] shrink-0 rounded-xl bg-[var(--wesal-pink-soft)]" aria-hidden="true" />
        )}
        <span className="min-w-0 text-start">
          <span className="block truncate text-base font-bold text-[var(--wesal-text)]">{name}</span>
          <span className="mt-1 block truncate text-sm text-[var(--wesal-muted)]">{location}</span>
          <span className="mt-1 block text-sm text-[var(--wesal-maroon)]">
            {capacity}
            {price ? ` · ${price}` : ""}
          </span>
        </span>
      </Link>
      <button
        type="button"
        className="btn-outline min-h-10 shrink-0 px-3 text-sm"
        onClick={onRemove}
      >
        {t("seeker.favorites.remove")}
      </button>
    </li>
  );
}
