"use client";

import { useT } from "@/i18n";
import { toYouTubeEmbedUrl } from "@/lib/youtube-embed";

type HallYouTubeEmbedProps = {
  url?: string | null;
};

/** Renders nothing when the hall has no valid YouTube link. */
export default function HallYouTubeEmbed({ url }: HallYouTubeEmbedProps) {
  const t = useT();
  const embedUrl = toYouTubeEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
      data-testid="hall-youtube"
    >
      <p className="mb-2 text-xs font-semibold text-[var(--wesal-muted)]">
        {t("halls.details.youtube")}
      </p>
      <div className="aspect-video overflow-hidden rounded-xl border border-[var(--wesal-border)]">
        <iframe
          src={embedUrl}
          title={t("halls.details.youtube")}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  );
}
