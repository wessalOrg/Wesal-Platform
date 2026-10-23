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
        className="wesal-simple-page container-wesal flex flex-col items-center justify-center px-4 py-6 text-center sm:py-16"
        data-testid="about-page"
      >
        <p className="text-sm font-semibold tracking-wide text-[var(--wesal-muted)]">
          {t("about.title")}
        </p>
        <h1 className="coming-soon-wave mt-4 text-5xl font-extrabold sm:mt-5 sm:text-8xl">
          {t("brand.name")}
        </h1>
        <div
          className="mx-auto mt-5 h-px w-40 bg-gradient-to-r from-transparent via-[var(--wesal-gold)] to-transparent sm:mt-6"
          aria-hidden="true"
        />
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--wesal-text)] sm:mt-6 sm:text-lg sm:leading-9">
          {t("about.body")}
        </p>
        <Link
          href="/"
          aria-label={t("common.backHome")}
          data-testid="about-back"
          className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wesal-gold)] text-[var(--wesal-maroon-dark)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white sm:mt-12"
        >
          <BackHomeArrow flip={lang === "en"} />
        </Link>
      </main>
      <Footer />
    </>
  );
}
