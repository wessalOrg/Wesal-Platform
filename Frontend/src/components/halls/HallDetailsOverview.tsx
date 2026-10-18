"use client";

import HallDetailsHeader from "@/components/halls/HallDetailsHeader";
import HallHeroGallery from "@/components/halls/HallHeroGallery";
import HallQuickInfo from "@/components/halls/HallQuickInfo";
import { useT } from "@/i18n";
import { toStoredYouTubeUrl, toYouTubeVideoId } from "@/lib/youtube-embed";
import type { HallDetail } from "@/types/hall";

type HallDetailsOverviewProps = {
  hall: HallDetail;
};

export default function HallDetailsOverview({ hall }: HallDetailsOverviewProps) {
  const t = useT();
  const youtubeHref = toYouTubeVideoId(hall.youtubeVideoUrl)
    ? toStoredYouTubeUrl(hall.youtubeVideoUrl ?? "")
    : "";

  return (
    <section
      className="space-y-6 rounded-[28px] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,45,0.04)] sm:p-5"
      data-testid="hall-details-overview"
    >
      <HallHeroGallery images={hall.gallery} hallName={hall.name} />
      {youtubeHref ? (
        <a
          href={youtubeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 text-base font-semibold text-[var(--wesal-text)]"
          data-testid="hall-youtube-link"
        >
          <YouTubeIcon />
          <span>
            <span className="font-bold text-[#241c18]">{t("halls.details.youtubeLead")}</span>{" "}
            <span className="font-bold text-[var(--wesal-maroon)] underline decoration-[var(--wesal-maroon)]/40 underline-offset-4 transition duration-200 group-hover:text-[var(--wesal-maroon-dark)] group-hover:decoration-[var(--wesal-maroon-dark)]">
              {t("halls.details.youtubeHere")}
            </span>
          </span>
        </a>
      ) : null}
      <HallDetailsHeader hall={hall} sections={[]} part="meta" />
      <HallQuickInfo hall={hall} />
    </section>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-[#c4302b]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C19.2 5.4 12 5.4 12 5.4s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6Z"
      />
      <path fill="#fff" d="M9.8 15.5v-6.6l6.2 3.3-6.2 3.3Z" />
    </svg>
  );
}
