"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const SERVICES = [
  { id: "s1", image: "/services/catering.webp" },
  { id: "s2", image: "/services/decor.webp" },
  { id: "s3", image: "/services/photo.webp" },
  { id: "s4", image: "/services/music.webp" },
  { id: "s5", image: "/services/lighting.webp" },
  { id: "s6", image: "/services/invitations.webp" },
] as const;

export default function OccasionServicesSection() {
  const t = useT();
  const lang = useUiLang();
  const cardsFromLeft = lang === "ar";

  return (
    <section
      id="occasion-services"
      className="occasion-services relative scroll-mt-20 py-16 sm:py-20"
      aria-labelledby="occasion-services-heading"
    >
      <div className="occasion-services-bg" aria-hidden="true">
        <span className="occasion-orb occasion-orb--a" />
        <span className="occasion-orb occasion-orb--b" />
        <span className="occasion-orb occasion-orb--c" />
      </div>
      <Reveal>
        <div className="container-wesal relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="occasion-services-heading"
              className="text-2xl font-extrabold text-[var(--wesal-maroon)] sm:text-3xl"
            >
              {t("home.services.title")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)] sm:text-base">
              {t("home.services.subtitle")}
            </p>
          </div>

          <ul
            dir={cardsFromLeft ? "ltr" : undefined}
            className="mt-10 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          >
            {SERVICES.map((service, index) => (
              <li
                key={service.id}
                className="occasion-service-card"
                style={{ animationDelay: `${80 + index * 90}ms` }}
              >
                <article
                  dir={cardsFromLeft ? "rtl" : undefined}
                  className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_12px_30px_rgba(90,55,45,0.06)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={service.image}
                      alt=""
                      className="occasion-service-photo h-full w-full object-cover"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
                      <h3 className="text-base font-extrabold leading-7 sm:text-lg">
                        {t(`home.services.${service.id}.title`)}
                      </h3>
                      <p className="mt-0.5 text-xs leading-6 text-white/85">
                        {t(`home.services.${service.id}.meta`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <p className="min-w-0 text-xs leading-6 text-[var(--wesal-muted)] sm:text-[0.8rem]">
                      {t(`home.services.${service.id}.desc`)}
                    </p>
                    <span
                      aria-hidden="true"
                      className="occasion-service-chevron inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M14 6l-6 6 6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
