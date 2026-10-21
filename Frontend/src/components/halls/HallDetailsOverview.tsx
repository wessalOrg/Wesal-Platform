"use client";

import HallDetailsHeader from "@/components/halls/HallDetailsHeader";
import HallHeroGallery from "@/components/halls/HallHeroGallery";
import HallQuickInfo from "@/components/halls/HallQuickInfo";
import HallYouTubeEmbed from "@/components/halls/HallYouTubeEmbed";
import type { HallDetail } from "@/types/hall";

type HallDetailsOverviewProps = {
  hall: HallDetail;
};

export default function HallDetailsOverview({ hall }: HallDetailsOverviewProps) {
  return (
    <section
      className="space-y-6 rounded-[28px] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,45,0.04)] sm:p-5"
      data-testid="hall-details-overview"
    >
      <HallHeroGallery images={hall.gallery} hallName={hall.name} />
      <HallYouTubeEmbed url={hall.youtubeVideoUrl} variant="link" />
      <HallDetailsHeader hall={hall} sections={[]} part="meta" />
      <HallQuickInfo hall={hall} />
    </section>
  );
}
