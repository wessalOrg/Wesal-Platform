"use client";

import Link from "next/link";
import LangDir from "@/components/layout/LangDir";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { requestOpenAssistant } from "@/lib/assistant-events";
import type { HomepageIntro } from "@/types/homepage";

type HeroCopyProps = {
  titleId?: string;
  intro: HomepageIntro;
};

function CompassIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hero copy: brand, heading, short description and the two calls to action. */
export default function HeroCopy({ titleId, intro }: HeroCopyProps) {
  const t = useT();
  const lang = useUiLang();
  const arrow = lang === "ar" ? "←" : "→";

  return (
    <LangDir className="hero-copy-enter mx-auto w-full max-w-[22rem] text-center">
      <p className="sr-only">{intro.platformName}</p>

      <h1
        id={titleId}
        className="hero-copy-title text-[1.2rem] font-extrabold leading-[1.7] text-[var(--wesal-gold)] sm:text-[1.4rem] md:-mx-8 md:text-[0.95rem] lg:text-[1.1rem] xl:text-[1.35rem]"
      >
        <span className="hero-copy-line block md:whitespace-nowrap">{t("home.hero.heading")}</span>
      </h1>

      <div
        className="hero-copy-divider mx-auto mt-3 h-px max-w-[10rem] bg-gradient-to-l from-transparent via-[var(--wesal-gold)] to-transparent"
        aria-hidden="true"
      />

      <div className="hero-copy-tagline mt-5 flex items-center gap-3">
        <span className="hero-copy-rule h-px flex-1 bg-[var(--wesal-maroon)]/70" />
        <p
          className="hero-copy-eyebrow shrink-0 text-[2rem] font-extrabold leading-none text-[var(--wesal-maroon)] sm:text-[2.4rem]"
          aria-hidden="true"
        >
          {t("brand.name")}
        </p>
        <span className="hero-copy-rule h-px flex-1 bg-[var(--wesal-maroon)]/70" />
      </div>

      <p className="hero-copy-desc mt-5 text-sm leading-8 text-black sm:text-[0.95rem]">
        {t("home.hero.description")}
      </p>

      <div className="hero-copy-desc mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="btn-primary min-h-11 whitespace-nowrap px-5 text-sm"
          onClick={requestOpenAssistant}
          data-testid="hero-cta-start"
        >
          {t("home.hero.ctaStart")}
          <span aria-hidden="true" className="ms-2">
            {arrow}
          </span>
        </button>
        <Link
          href="/halls"
          className="btn-outline min-h-11 gap-2 whitespace-nowrap px-5 text-sm"
          data-testid="hero-cta-explore"
        >
          <CompassIcon />
          {t("home.hero.ctaExplore")}
        </Link>
      </div>
    </LangDir>
  );
}
