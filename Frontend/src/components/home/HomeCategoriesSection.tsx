"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import Reveal from "@/components/ui/Reveal";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

type Category = {
  id: string;
  href: string;
  image: string;
  icon: ReactNode;
  titleKey: string;
  subtitleKey: string;
  hintKey: string;
};

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function HallIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4.5 9.5h15" />
      <path d="M6 9.5v8M10 9.5v8M14 9.5v8M18 9.5v8" />
      <path d="M3.5 17.5h17M2.5 20h19" />
    </svg>
  );
}

function CoordinatorIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M12 17.4c-2.2-1.5-3.3-2.6-3.3-3.9 0-1 .8-1.7 1.7-1.7.7 0 1.2.4 1.6.9.4-.5.9-.9 1.6-.9.9 0 1.7.7 1.7 1.7 0 1.3-1.1 2.4-3.3 3.9Z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2.8" y="6.5" width="12.4" height="11" rx="2.4" />
      <path d="m15.2 10.6 5.4-3v9.8l-5.4-3v-3.8Z" />
    </svg>
  );
}

const CATEGORIES: Category[] = [
  {
    id: "halls",
    href: "/halls",
    image: "/home/halls.jpg",
    icon: <HallIcon />,
    titleKey: "home.categories.halls.title",
    subtitleKey: "home.categories.halls.subtitle",
    hintKey: "home.categories.halls.hint",
  },
  {
    id: "planners",
    href: "/event-planners",
    image: "/home/planners-day.jpg",
    icon: <CoordinatorIcon />,
    titleKey: "home.categories.planners.title",
    subtitleKey: "home.categories.planners.subtitle",
    hintKey: "home.categories.planners.hint",
  },
  {
    id: "photographers",
    href: "/photographers",
    image: "/home/photographers-venue.jpg",
    icon: <CameraIcon />,
    titleKey: "home.categories.photographers.title",
    subtitleKey: "home.categories.photographers.subtitle",
    hintKey: "home.categories.photographers.hint",
  },
];

/* Card geometry (px): white panel height, where its flat top edge sits
   (PLATEAU_Y), the rounded corner that lands on the card's bottom line, and
   the icon bubble. */
const PANEL_H = 98;
const PLATEAU_Y = 16;
/** Width (of 300) of the rounded corner that ends on the card's bottom line. */
const CORNER_W = 108;
const BUBBLE = 58;
const BUBBLE_INSET = 26;
const FILLET = 10;
const KAPPA = 0.5523;

/** Landing page category cards: halls, event planners and photographers. */
export default function HomeCategoriesSection() {
  const t = useT();
  const lang = useUiLang();
  const rtl = lang === "ar";
  const arrow = rtl ? "←" : "→";
  const side = rtl ? "right" : "left";

  return (
    <section
      className="bg-[var(--wesal-cream)] py-11 sm:py-14"
      aria-label={t("home.categories.aria")}
      data-testid="home-categories-section"
    >
      <Reveal>
        <div className="container-wesal">
          <ul className="mx-auto grid max-w-[60rem] gap-[1.15rem] sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {CATEGORIES.map((category) => (
              <li key={category.id}>
                <Link
                  href={category.href}
                  className="group block rounded-[1.6rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wesal-maroon)]"
                  data-testid={`home-category-${category.id}`}
                >
                  <div className="home-category-card relative aspect-square overflow-hidden rounded-[1.28rem] shadow-[0_11px_26px_rgba(90,55,45,0.11)] transition-transform duration-300 group-hover:-translate-y-1">
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      quality={80}
                      unoptimized={category.id === "planners"}
                      className="object-cover object-center"
                    />

                    <div
                      className="home-category-panel absolute inset-x-0 bottom-0"
                      style={{ height: PANEL_H }}
                    >
                      {/* Solid base so rounded card corners never flash a light seam */}
                      <div
                        className="home-category-panel-base absolute inset-x-0 bottom-0"
                        style={{
                          height: PANEL_H - PLATEAU_Y + 2,
                          background: "var(--home-category-panel, var(--wesal-white))",
                        }}
                        aria-hidden="true"
                      />
                      {/* Panel: flat on the icon side, rounded corner on the bottom line. */}
                      <svg
                        className={`home-category-panel-svg absolute inset-0 h-full w-full ${rtl ? "" : "-scale-x-100"}`}
                        viewBox={`0 0 300 ${PANEL_H}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          className="home-category-panel-fill"
                          d={`M-1,${PANEL_H + 1} C-1,${PANEL_H - KAPPA * (PANEL_H - PLATEAU_Y)} ${CORNER_W * (1 - KAPPA)},${PLATEAU_Y} ${CORNER_W},${PLATEAU_Y} L301,${PLATEAU_Y} L301,${PANEL_H + 1} Z`}
                          fill="var(--home-category-panel, var(--wesal-white))"
                        />
                      </svg>

                      {/* Icon bubble rising above the panel */}
                      <span
                        className="home-category-bubble absolute flex items-center justify-center rounded-full bg-[var(--wesal-white)] text-[var(--wesal-maroon)] shadow-[0_4px_14px_rgba(90,55,45,0.12)] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:stroke-[1.4]"
                        style={{
                          width: BUBBLE,
                          height: BUBBLE,
                          top: PLATEAU_Y - BUBBLE / 2 - 28,
                          [side]: BUBBLE_INSET,
                        }}
                        aria-hidden="true"
                      >
                        {category.icon}
                      </span>
                      {/* Soft joins between the bubble and the flat edge */}
                      <span
                        className="home-category-fillet pointer-events-none absolute"
                        style={{
                          width: FILLET,
                          height: FILLET,
                          top: PLATEAU_Y - FILLET,
                          [side]: BUBBLE_INSET - FILLET,
                          background: `radial-gradient(circle at ${rtl ? "100%" : "0%"} 0%, transparent ${FILLET - 0.5}px, var(--home-category-panel, var(--wesal-white)) ${FILLET}px)`,
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className="home-category-fillet pointer-events-none absolute"
                        style={{
                          width: FILLET,
                          height: FILLET,
                          top: PLATEAU_Y - FILLET,
                          [side]: BUBBLE_INSET + BUBBLE,
                          background: `radial-gradient(circle at ${rtl ? "0%" : "100%"} 0%, transparent ${FILLET - 0.5}px, var(--home-category-panel, var(--wesal-white)) ${FILLET}px)`,
                        }}
                        aria-hidden="true"
                      />

                      <div className="absolute inset-x-0 bottom-0 px-5 pb-3 text-center">
                        <h3 className="home-category-title text-base font-extrabold leading-snug text-[var(--wesal-maroon-dark)]">
                          {t(category.titleKey)}
                        </h3>
                        <p className="home-category-subtitle mt-0.5 text-[0.8rem] font-bold leading-snug text-[var(--wesal-text)]">
                          {t(category.subtitleKey)}
                        </p>
                        <p className="home-category-hint mt-0.5 text-[0.75rem] font-bold leading-snug text-[var(--wesal-text)]">
                          {t(category.hintKey)}
                        </p>
                      </div>
                      <span
                        className="absolute bottom-8 end-3 text-base font-bold text-[var(--wesal-maroon)] transition-transform rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1"
                        aria-hidden="true"
                      >
                        {arrow}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
