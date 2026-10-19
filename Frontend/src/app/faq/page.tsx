"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useT } from "@/i18n";

const FAQ_ITEMS = [1, 2, 3, 4, 5, 6] as const;

export default function FaqPage() {
  const t = useT();

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">{t("faq.title")}</h1>
        <p className="mt-3 text-[var(--wesal-muted)]">{t("faq.intro")}</p>

        <ul className="mt-8 space-y-4" data-testid="faq-list">
          {FAQ_ITEMS.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5 shadow-[0_8px_22px_rgba(90,55,45,0.05)]"
            >
              <h2 className="text-base font-bold text-[var(--wesal-text)]">
                {t(`faq.q${item}`)}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
                {t(`faq.a${item}`)}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-[var(--wesal-muted)]">
          {t("faq.stillNeedHelp")}{" "}
          <Link href="/help" className="font-bold text-[var(--wesal-maroon)] underline">
            {t("faq.contactTeam")}
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
