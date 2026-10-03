"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

export default function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const t = useT();
  const lang = useUiLang();

  return (
    <>
      <Navbar />
      <main className="container-wesal flex min-h-[70svh] flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm font-semibold tracking-wide text-[var(--wesal-muted)]">{t(titleKey)}</p>
        <h1 className="coming-soon-wave mt-5 text-6xl font-extrabold sm:text-8xl">
          {t("comingSoon.word")}
        </h1>
        <Link
          href="/"
          aria-label={t("common.backHome")}
          data-testid="coming-soon-back"
          className="mt-12 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wesal-gold)] text-[var(--wesal-maroon-dark)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white"
        >
          <BackHomeArrow flip={lang === "en"} />
        </Link>
      </main>
      <Footer />
    </>
  );
}

function BackHomeArrow({ flip }: { flip: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-6 w-6 ${flip ? "-scale-x-100" : ""}`}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
