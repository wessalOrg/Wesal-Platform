"use client";

import { useT } from "@/i18n";

type HallUnavailableBannerProps = {
  hallName: string;
};

export default function HallUnavailableBanner({ hallName }: HallUnavailableBannerProps) {
  const t = useT();

  return (
    <div
      className="rounded-2xl border border-[rgba(193,123,127,0.35)] bg-[var(--wesal-pink-soft)] px-5 py-4 text-center sm:text-start"
      role="status"
      data-testid="hall-unavailable-banner"
    >
      <p className="text-base font-bold text-[var(--wesal-maroon-dark)]">
        {t("halls.details.unavailableTitle")}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-text)]">
        {hallName} — {t("halls.details.unavailableDesc")}
      </p>
    </div>
  );
}
