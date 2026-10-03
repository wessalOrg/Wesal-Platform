"use client";

import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const STEPS = [
  {
    titleKey: "home.how.step1.title",
    descKey: "home.how.step1.desc",
    noteKey: "home.how.step1.note",
    icon: "spark",
  },
  {
    titleKey: "home.how.step2.title",
    descKey: "home.how.step2.desc",
    noteKey: "home.how.step2.note",
    icon: "search",
  },
  {
    titleKey: "home.how.step3.title",
    descKey: "home.how.step3.desc",
    noteKey: "home.how.step3.note",
    icon: "card",
  },
  {
    titleKey: "home.how.step4.title",
    descKey: "home.how.step4.desc",
    noteKey: "home.how.step4.note",
    icon: "celebrate",
  },
] as const;

export default function HowItWorksSection() {
  const t = useT();

  return (
    <section
      id="how-it-works"
      className="how-section relative isolate scroll-mt-20 overflow-hidden py-16 sm:py-20"
    >
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

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {STEPS.map((step, index) => (
            <article
              key={step.titleKey}
              className="how-card group relative flex flex-col overflow-hidden rounded-[1.6rem] border border-white/80 bg-white px-5 py-7 text-center shadow-[0_16px_36px_rgba(120,70,70,0.08)]"
              style={{ animationDelay: `${140 + index * 120}ms` }}
            >
              <div className="flex w-full">
                <div
                  className="how-card-icon ms-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f6f0e8] text-[#c4a05c]"
                  style={{ animationDelay: `${280 + index * 120}ms` }}
                >
                  <StepIcon type={step.icon} />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-[var(--wesal-text)]">
                {t(step.titleKey)}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-[var(--wesal-muted)]">
                {t(step.descKey)}
              </p>
              <p className="mt-5 text-xs font-semibold text-[var(--wesal-gold)]">
                {t(step.noteKey)}
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
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };

  if (type === "spark") {
    return (
      <svg {...common}>
        <path
          d="M9.2 3.4 10.2 7l3.6 1-3.6 1-1 3.6-1-3.6-3.6-1 3.6-1 1-3.6Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M16.6 12.2 17.3 14.6l2.4.7-2.4.7-.7 2.4-.7-2.4-2.4-.7 2.4-.7.7-2.4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg {...common}>
        <circle cx="10.5" cy="10.5" r="5.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14.6 14.6 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "card") {
    return (
      <svg {...common}>
        <rect x="4" y="6.2" width="16" height="11.6" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="7" y="9.1" width="5.2" height="3.6" rx="0.7" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M4.6 19.5 10.4 11.4c.35-.52 1.08-.58 1.5-.08l2.35 2.55c.42.46.36 1.16-.12 1.55L7.15 20.4c-.62.5-1.55.12-1.78-.62l-.77-1.28Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M13.4 8.4 15.1 6.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M16.2 9.7 18.5 8.7" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M15.6 4.8 16.5 2.9" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="18.8" cy="5.2" r="0.75" fill="currentColor" />
      <circle cx="18.1" cy="11.6" r="0.6" fill="currentColor" />
    </svg>
  );
}
