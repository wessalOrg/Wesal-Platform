"use client";

import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const STEPS = [
  {
    titleKey: "home.how.step1.title",
    descKey: "home.how.step1.desc",
    icon: "spark",
  },
  {
    titleKey: "home.how.step2.title",
    descKey: "home.how.step2.desc",
    icon: "search",
  },
  {
    titleKey: "home.how.step3.title",
    descKey: "home.how.step3.desc",
    icon: "book",
  },
] as const;

export default function HowItWorksSection() {
  const t = useT();

  return (
    <section className="how-section relative isolate overflow-hidden py-16 sm:py-20">
      <div className="how-section-bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/how/rose-marble-soft.webp?v=2"
          alt=""
          className="how-marble"
          decoding="async"
        />
        <div className="how-marble-wash" />
        <div className="how-sheen" />
        <span className="how-glint how-glint--1" />
        <span className="how-glint how-glint--2" />
        <span className="how-glint how-glint--3" />
        <span className="how-glint how-glint--4" />
      </div>

      <Reveal>
      <div className="container-wesal relative z-10">
        <div className="how-heading mx-auto max-w-2xl text-center">
          <p className="how-eyebrow mb-3 text-sm font-semibold tracking-wide text-[var(--wesal-gold)]">
            {t("home.how.eyebrow")}
          </p>
          <h2 className="text-2xl font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-3xl">
            {t("home.how.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-[var(--wesal-text)]/80 sm:text-base">
            {t("home.how.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, index) => (
            <article
              key={step.titleKey}
              className="how-card group relative overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-7 text-center shadow-[0_14px_36px_rgba(90,55,45,0.08)] backdrop-blur-md"
              style={{ animationDelay: `${180 + index * 160}ms` }}
            >
              <span className="how-card-shine" aria-hidden="true" />
              <div
                className="how-card-icon mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"
                style={{ animationDelay: `${400 + index * 180}ms` }}
              >
                <StepIcon type={step.icon} />
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-[var(--wesal-maroon)]">
                {t(step.titleKey)}
              </h3>
              <p className="mt-2.5 text-sm leading-8 text-[var(--wesal-text)]/75">
                {t(step.descKey)}
              </p>
            </article>
          ))}
        </div>
      </div>
      </Reveal>
    </section>
  );
}

function StepIcon({ type }: { type: (typeof STEPS)[number]["icon"] }) {
  if (type === "spark") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l1.2 6.3L19.5 10 13.2 11.2 12 17.5l-1.2-6.3L4.5 10l6.3-1.2L12 2.5Z" />
        <path d="M18.5 14.2l.55 2.8 2.75.55-2.75.55-.55 2.8-.55-2.8-2.75-.55 2.75-.55.55-2.8Z" opacity="0.75" />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10h8M8 13.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
