"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { HALL_REGION_LABEL_KEYS, isHallRegion } from "@/constants/hallRegions";
import { useT } from "@/i18n";
import { HALL_OWNER_HALLS_PATH } from "@/lib/account-profile-path";
import HallYouTubeEmbed from "@/components/halls/HallYouTubeEmbed";
import { localizeHallName } from "@/lib/localize-hall-display";
import { fetchOwnerHallDetails } from "@/services/hall-owner-hall-management";
import type { HallOwnerHallDetails } from "@/types/hall-owner-hall-management";

type OwnerHallReadOnlyViewProps = {
  hallId: string;
};

export default function OwnerHallReadOnlyView({ hallId }: OwnerHallReadOnlyViewProps) {
  const t = useT();
  const lang = useUiLang();
  const [details, setDetails] = useState<HallOwnerHallDetails | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorKey(null);
    void fetchOwnerHallDetails(hallId)
      .then((next) => {
        if (!cancelled) setDetails(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "";
        setErrorKey(
          message.startsWith("owner.") || message.startsWith("errors.")
            ? message
            : "owner.management.halls.loadError",
        );
        setDetails(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hallId, reloadKey]);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-[28px] bg-white/80" aria-busy="true" />;
  }

  if (!details) {
    return (
      <section className="rounded-2xl bg-white p-6" role="alert">
        <p className="text-sm text-[var(--wesal-muted)]">{t(errorKey ?? "owner.management.halls.loadError")}</p>
        <button type="button" className="btn-outline mt-4" onClick={() => setReloadKey((value) => value + 1)}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  const name = localizeHallName(details.id, details.name, lang);
  const region = details.region && isHallRegion(details.region) ? t(HALL_REGION_LABEL_KEYS[details.region]) : "";
  const photos = hallPhotoUrls(details);
  const price =
    details.price != null && details.price > 0 ? `${details.price.toLocaleString("en-US")} ₪` : "—";
  const hours =
    details.hourlySlotStart && details.hourlySlotEnd
      ? `${details.hourlySlotStart} – ${details.hourlySlotEnd}`
      : "—";

  return (
    <article className="space-y-5" data-testid="owner-hall-readonly">
      <div>
        <Link href={HALL_OWNER_HALLS_PATH} className="text-sm font-semibold text-[var(--wesal-maroon)]">
          {t("owner.hallsPage.backToList")}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-[var(--wesal-maroon-dark)]">{name}</h1>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("owner.hallsPage.viewOnlyNote")}</p>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-[var(--wesal-border)] bg-white">
        {photos.length > 0 ? (
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {photos.map((url) => (
              <img key={url} src={url} alt="" className="h-52 w-full rounded-2xl object-cover sm:h-64" />
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-[var(--wesal-muted)]">{t("owner.management.addHall.sections.photos")}</p>
        )}
        <div className="px-5 pb-5">
          <HallYouTubeEmbed url={details.youtubeVideoUrl} variant="link" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--wesal-border)] bg-white p-5">
        <h2 className="text-lg font-extrabold text-[var(--wesal-text)]">
          {t("owner.management.addHall.sections.basic")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label={t("owner.management.addHall.fields.ownerPhone")} value={details.contactPhone} />
          <ReadOnlyField
            label={t("owner.management.addHall.fields.guestCapacity")}
            value={details.capacity > 0 ? t("owner.hallsPage.guests", { count: details.capacity }) : "—"}
          />
          <ReadOnlyField label={t("owner.management.addHall.fields.rentalPrice")} value={price} />
          <ReadOnlyField label={t("owner.management.addHall.sections.periods")} value={hours} />
        </dl>
      </section>

      <section className="rounded-[28px] border border-[var(--wesal-border)] bg-white p-5">
        <h2 className="text-lg font-extrabold text-[var(--wesal-text)]">
          {t("owner.management.addHall.sections.location")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label={t("owner.management.addHall.fields.region")} value={region} />
          <ReadOnlyField label={t("owner.management.addHall.fields.address")} value={details.address} />
          <ReadOnlyField
            label={t("owner.management.addHall.fields.detailedAddress")}
            value={details.detailedAddress}
          />
        </dl>
      </section>

      <section className="rounded-[28px] border border-[var(--wesal-border)] bg-white p-5">
        <h2 className="text-lg font-extrabold text-[var(--wesal-text)]">
          {t("owner.management.addHall.sections.features")}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">
          {details.description.trim() || "—"}
        </p>
        {details.features.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {details.features.map((feature) => (
              <li
                key={feature}
                className="rounded-full bg-[#f7eee9] px-3 py-1 text-sm font-semibold text-[var(--wesal-maroon-dark)]"
              >
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
        {details.otherFeatures.trim() ? (
          <p className="mt-4 text-sm leading-7 text-[var(--wesal-text)]">{details.otherFeatures}</p>
        ) : null}
      </section>
    </article>
  );
}

function hallPhotoUrls(details: HallOwnerHallDetails): string[] {
  const urls: string[] = [];
  if (details.mainImageUrl) urls.push(details.mainImageUrl);
  for (const photo of details.photos) {
    if (photo.url && !urls.includes(photo.url)) urls.push(photo.url);
  }
  return urls;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--wesal-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-[var(--wesal-text)]">{value.trim() || "—"}</dd>
    </div>
  );
}
