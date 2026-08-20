"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useT } from "@/i18n";

export default function AboutPage() {
  const t = useT();

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          {t("about.title")}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--wesal-muted)]">
          {t("about.body")}
        </p>
        <Link href="/" className="btn-outline mt-8">
          {t("common.backHome")}
        </Link>
      </main>
      <Footer />
    </>
  );
}
