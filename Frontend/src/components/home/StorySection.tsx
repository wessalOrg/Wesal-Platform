"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useUiLang } from "@/components/layout/LanguageProvider";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const STATS = [
  { id: "stat1", target: 1200 },
  { id: "stat2", target: 500 },
  { id: "stat3", target: 100 },
] as const;

const statNumber = new Intl.NumberFormat("en-US");

function StoryStatValue({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    const duration = 1400;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return (
    <p className="story-stat-value" dir="ltr">
      <span>+</span>
      <span>{statNumber.format(value)}</span>
    </p>
  );
}

export default function StorySection() {
  const t = useT();
  const lang = useUiLang();
  const cardsFromLeft = lang === "ar";
  const statsRef = useRef<HTMLUListElement>(null);
  const [statsActive, setStatsActive] = useState(false);

  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setStatsActive(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setStatsActive(true);
        observer.disconnect();
      },
      { threshold: 0.45 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="occasion-story"
      className="occasion-story relative scroll-mt-20 py-7 sm:py-14"
      aria-labelledby="occasion-story-heading"
    >
      <Reveal>
        <div className="story-layout">
          <div className="story-photo">
            <Image
              src="/home/story-collage.jpg?v=5"
              alt={t("home.story.imageAlt")}
              width={920}
              height={864}
              className="story-collage-img"
              sizes="(min-width: 1024px) 30rem, 70vw"
              quality={80}
            />
          </div>
          <div className="story-copy" dir={lang === "ar" ? "rtl" : "ltr"}>
              <h2
                id="occasion-story-heading"
                className="wesal-section-heading text-2xl font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-[1.85rem]"
              >
                {t("home.story.title")}
              </h2>
              <p className="mt-3.5 text-[0.95rem] leading-7 text-[var(--wesal-text)]/80 sm:mt-4 sm:text-base sm:leading-8">
                {t("home.story.body1")}
              </p>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--wesal-text)]/80 sm:text-base sm:leading-8">
                {t("home.story.body2")}
              </p>
              <ul
                ref={statsRef}
                className="mt-6 grid grid-cols-1 gap-2.5 sm:mt-7 sm:grid-cols-3 sm:gap-2.5"
                dir={cardsFromLeft ? "ltr" : undefined}
              >
                {STATS.map((stat, index) => (
                  <li
                    key={stat.id}
                    className="story-stat"
                    dir={cardsFromLeft ? "rtl" : undefined}
                    style={{
                      animationDelay: `${0.1 + index * 0.12}s, ${0.9 + index * 0.35}s`,
                    }}
                  >
                    <div className="story-stat-card">
                      <StoryStatValue target={stat.target} active={statsActive} />
                      <p className="story-stat-label">
                        {t(`home.story.${stat.id}.label`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
