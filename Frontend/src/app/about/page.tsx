"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { BackHomeArrow } from "@/components/layout/ComingSoonPage";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

export default function AboutPage() {
  const t = useT();
  const lang = useUiLang();

  return (
    <>
      <Navbar />
      <main
        className="container-wesal flex min-h-[70svh] flex-col items-center justify-center px-4 py-16 text-center"
        data-testid="about-page"
      >
        <p className="text-sm font-semibold tracking-wide text-[var(--wesal-muted)]">
          {t("about.title")}
        </p>
        <h1 className="coming-soon-wave mt-5 text-6xl font-extrabold sm:text-8xl">
          {t("brand.name")}
        </h1>
        <div
          className="mx-auto mt-6 h-px w-40 bg-gradient-to-r from-transparent via-[var(--wesal-gold)] to-transparent"
          aria-hidden="true"
        />
        <p className="mt-6 max-w-2xl text-base leading-9 text-[var(--wesal-text)] sm:text-lg">
          {t("about.body")}
        </p>
        <Link
          href="/"
          aria-label={t("common.backHome")}
          data-testid="about-back"
          className="mt-12 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wesal-gold)] text-[var(--wesal-maroon-dark)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white"
        >
          <BackHomeArrow flip={lang === "en"} />
        </Link>
      </main>
      <Footer />
    </>
  );
}
