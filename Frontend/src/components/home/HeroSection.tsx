import HeroCopy from "@/components/home/HeroCopy";
import HeroPhoto from "@/components/home/HeroPhoto";
import { HOMEPAGE_INTRO_FALLBACK } from "@/constants/homepageFallback";
import { fetchHomepageIntro } from "@/services/homepage";
import type { HomepageIntro } from "@/types/homepage";

/** Exact design reference dimensions */
const VBW = 1536;
const VBH = 760;

const CURVE_D =
  "M420,0 L560,0 C680,25 790,120 710,220 C660,300 580,400 550,500 C525,580 580,650 720,710 C860,760 1000,760 1140,760";

const GOLD_D =
  "M560,2 C680,28 790,120 710,220 C660,300 580,400 550,500 C525,580 580,650 720,710 C860,760 1000,760 1120,760";

const CREAM_D = `${CURVE_D} L0,${VBH} L0,0 Z`;

const EDGE_MOBILE = "M 0 28 C 280 72, 720 72, 1000 28";
const CREAM_MOBILE = "M 0 0 L 1000 0 L 1000 28 C 720 72, 280 72, 0 28 Z";

export default async function HeroSection() {
  const goldId = "wesal-hero-gold";
  const intro = await Promise.race([
    fetchHomepageIntro(),
    new Promise<HomepageIntro>((resolve) => {
      setTimeout(() => {
        resolve({ ...HOMEPAGE_INTRO_FALLBACK, isFallback: true });
      }, 400);
    }),
  ]);

  return (
    <section
      aria-labelledby="wesal-hero-title"
      className="hero-stage relative isolate overflow-hidden px-4 py-6 md:px-6 md:py-8"
      data-testid="hero-section"
    >
      <div
        dir="ltr"
        className="hero-card hero-showcase relative mx-auto hidden w-full max-w-[90rem] overflow-hidden rounded-[32px] md:block"
        style={{ aspectRatio: `${VBW} / ${VBH}` }}
      >
        <div className="hero-photo-pane absolute inset-0 overflow-hidden">
          <HeroPhoto />
          <div className="hero-photo-grade" aria-hidden="true" />
        </div>

        <svg
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
          viewBox={`0 0 ${VBW} ${VBH}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${goldId}-satin`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="22%" stopColor="#FCFBF9" />
              <stop offset="48%" stopColor="#F7F0EA" />
              <stop offset="72%" stopColor="#FCFAF7" />
              <stop offset="100%" stopColor="#F8F4EF" />
            </linearGradient>
            <radialGradient id={`${goldId}-pearl`} cx="36%" cy="46%" r="58%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#EDE4DA" stopOpacity="0.18" />
            </radialGradient>
            <linearGradient
              id={`${goldId}-edge`}
              x1="28%"
              y1="0%"
              x2="58%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
              <stop offset="40%" stopColor="#FCFBF9" stopOpacity="0.5" />
              <stop offset="75%" stopColor="#F8F4EF" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#F8F4EF" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id={goldId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E2C98A" />
              <stop offset="45%" stopColor="#C4A05C" />
              <stop offset="100%" stopColor="#E8D4A0" />
            </linearGradient>
          </defs>

          <path d={CREAM_D} fill={`url(#${goldId}-satin)`} opacity="0.94" />
          <path d={CREAM_D} fill={`url(#${goldId}-pearl)`} />
          <path d={CREAM_D} fill={`url(#${goldId}-edge)`} />

          <path
            className="hero-gold-glow"
            d={GOLD_D}
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.2"
          />
          <path
            className="hero-gold-line"
            d={GOLD_D}
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="hero-cream-decor" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/dream-ink.webp"
            alt=""
            className="hero-ink-bg"
            decoding="async"
            loading="lazy"
          />
        </div>

        <div className="relative z-10 flex h-full max-w-[34%] items-center justify-center px-6 md:px-10 lg:px-12">
          <HeroCopy titleId="wesal-hero-title" intro={intro} />
        </div>
      </div>

      <div className="hero-card hero-showcase md:hidden">
        <div className="hero-satin relative overflow-hidden rounded-t-[24px] px-6 py-12 sm:px-10">
          <div className="hero-cream-decor hero-cream-decor--mobile" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero/dream-ink.webp"
              alt=""
              className="hero-ink-bg"
              decoding="async"
              loading="lazy"
            />
          </div>
          <div className="relative z-10">
            <HeroCopy intro={intro} />
          </div>
        </div>
        <div className="hero-photo-pane relative min-h-[22rem] w-full overflow-hidden rounded-b-[24px] sm:min-h-[28rem]">
          <svg
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 w-full -translate-y-[1px]"
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="wesal-hero-mcream" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FCFBF9" />
                <stop offset="100%" stopColor="#F8F4EF" />
              </linearGradient>
            </defs>
            <path d={CREAM_MOBILE} fill="url(#wesal-hero-mcream)" />
            <path
              className="hero-gold-line-mobile"
              d={EDGE_MOBILE}
              fill="none"
              stroke="#C4A05C"
              strokeWidth="1.4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <HeroPhoto showAlt />
          <div className="hero-photo-grade hero-photo-grade--mobile" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
