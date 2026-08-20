"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useT } from "@/i18n";

export default function FaqPage() {
  const t = useT();

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          {t("faq.title")}
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">{t("faq.placeholder")}</p>
      </main>
      <Footer />
    </>
  );
}
