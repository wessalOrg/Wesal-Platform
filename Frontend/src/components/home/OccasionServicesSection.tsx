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
      className="occasion-services relative scroll-mt-20 py-11 sm:py-14"
      aria-labelledby="occasion-services-heading"
    >
      <div className="occasion-services-bg" aria-hidden="true">
        <span className="occasion-orb occasion-orb--a" />
        <span className="occasion-orb occasion-orb--b" />
        <span className="occasion-orb occasion-orb--c" />
      </div>
      <Reveal>
        <div className="container-wesal relative z-10">
          <div className="mx-auto max-w-[60rem]">
            <div className="mx-auto max-w-xl text-center">
              <h2
                id="occasion-services-heading"
                className="wesal-section-heading text-[1.35rem] font-extrabold text-[var(--wesal-maroon)] sm:text-[1.7rem]"
              >
                {t("home.services.title")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--wesal-muted)] sm:text-[0.95rem]">
                {t("home.services.subtitle")}
              </p>
            </div>

            <ul
              dir={cardsFromLeft ? "ltr" : undefined}
              className="mt-8 grid list-none grid-cols-1 gap-[1.15rem] p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
            >
              {SERVICES.map((service, index) => (
                <li
                  key={service.id}
                  className="occasion-service-card"
                  style={{ animationDelay: `${80 + index * 90}ms` }}
                >
                  <article
                    dir={cardsFromLeft ? "rtl" : undefined}
                    className="overflow-hidden rounded-[0.95rem] border-0 bg-[var(--wesal-white)] shadow-[0_11px_26px_rgba(90,55,45,0.06)]"
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
                      <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5 text-white">
                        <h3 className="text-[0.95rem] font-extrabold leading-6 sm:text-base">
                          {t(`home.services.${service.id}.title`)}
                        </h3>
                        <p className="mt-0.5 text-[0.75rem] leading-5 text-white/85 sm:text-xs">
                          {t(`home.services.${service.id}.meta`)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3.5 py-3 sm:py-3.5">
                      <p className="min-w-0 text-[0.75rem] leading-5 text-[var(--wesal-muted)] sm:text-xs">
                        {t(`home.services.${service.id}.desc`)}
                      </p>
                      <span
                        aria-hidden="true"
                        className="occasion-service-chevron inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)] sm:h-7 sm:w-7"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
        </div>
      </Reveal>
    </section>
  );
}
