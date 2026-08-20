"use client";

import LangDir from "@/components/layout/LangDir";
import { useT } from "@/i18n";
import type { HomepageIntro } from "@/types/homepage";

type HeroCopyProps = {
  titleId?: string;
  intro: HomepageIntro;
};

/** Hero intro copy — uses i18n when the API fallback path is active. */
export default function HeroCopy({ titleId, intro }: HeroCopyProps) {
  const t = useT();

  const platformName = intro.isFallback ? t("brand.name") : intro.platformName;
  const tagline = intro.isFallback ? t("home.hero.tagline") : intro.tagline;
  const titleLine1 = intro.isFallback ? t("home.hero.title1") : intro.titleLine1;
  const titleLine2 = intro.isFallback ? t("home.hero.title2") : intro.titleLine2;
  const description = intro.isFallback
    ? t("home.hero.description")
    : intro.description;

  return (
    <LangDir className="hero-copy-enter mx-auto w-full max-w-[18rem] text-center sm:max-w-[20rem]">
      <p className="sr-only">{platformName}</p>

      <div className="hero-copy-tagline flex items-center gap-3">
        <span className="hero-copy-rule h-px flex-1 bg-[var(--wesal-gold)]/70" />
        <p className="hero-copy-eyebrow shrink-0 text-[0.75rem] font-medium leading-6 tracking-wide text-[var(--wesal-gold)] sm:text-[0.85rem]">
          {tagline}
        </p>
        <span className="hero-copy-rule h-px flex-1 bg-[var(--wesal-gold)]/70" />
      </div>

      <h1
        id={titleId}
        className="hero-copy-title mt-6 text-[1.75rem] font-extrabold leading-[1.4] sm:text-[2.2rem] lg:text-[2.45rem]"
      >
        <span className="hero-copy-line block text-[var(--wesal-maroon)]">
          {titleLine1}
        </span>
        <span className="hero-copy-line hero-copy-line--late mt-1 block text-[var(--wesal-maroon)]">
          {titleLine2}
        </span>
      </h1>

      <div
        className="hero-copy-divider mx-auto mt-5 h-px max-w-[10rem] bg-gradient-to-l from-transparent via-[var(--wesal-gold)] to-transparent"
        aria-hidden="true"
      />

      <p className="hero-copy-desc mt-5 text-sm leading-8 text-[var(--wesal-muted)] sm:text-[0.95rem]">
        {description}
      </p>
    </LangDir>
  );
}
