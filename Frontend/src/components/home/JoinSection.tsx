"use client";

import Link from "next/link";
import WesalLogo from "@/components/brand/WesalLogo";
import { useAddHallCta } from "@/hooks/useAddHallCta";
import { useT } from "@/i18n";

export default function JoinSection() {
  const t = useT();
  const addHall = useAddHallCta();

  return (
    <section className="join-band relative isolate overflow-hidden" aria-labelledby="join-heading">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/footer/dream-silk.webp?v=1"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
        decoding="async"
      />
      <div className="join-band-wash pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="container-wesal relative z-10 py-8 sm:py-10">
        <div className="join-card flex flex-col items-center gap-6 px-5 py-7 text-center sm:px-8 md:flex-row md:items-center md:justify-between md:gap-8 md:text-start">
          <div className="flex max-w-md flex-col items-center gap-3 md:items-start">
            <Link href="/" className="inline-flex items-center gap-2 text-white" aria-label={t("brand.name")}>
              <WesalLogo variant="white" className="h-9 w-auto sm:h-10" title={t("brand.name")} />
              <span className="text-lg font-bold sm:text-xl">{t("brand.name")}</span>
            </Link>
            <h2
              id="join-heading"
              className="max-w-[16rem] text-[1.45rem] font-extrabold leading-snug text-white sm:max-w-[18rem] sm:text-[1.7rem]"
            >
              {t("home.join.title")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={addHall.href}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-[var(--wesal-maroon-dark)] transition-colors hover:bg-[var(--wesal-pink-soft)]"
              aria-disabled={!addHall.isReady || undefined}
              data-testid="join-register-hall"
              onClick={addHall.guardClick}
              onMouseEnter={addHall.prefetch}
              onFocus={addHall.prefetch}
            >
              {t("home.join.registerHall")}
            </Link>
            <Link
              href="#consult"
              className="inline-flex min-h-11 items-center rounded-full border border-white/85 bg-transparent px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              data-testid="join-register-service"
            >
              {t("home.join.registerService")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
