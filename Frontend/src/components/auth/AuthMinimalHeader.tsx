"use client";

import Link from "next/link";
import WesalLogo from "@/components/brand/WesalLogo";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useT } from "@/i18n";

export default function AuthMinimalHeader() {
  const t = useT();

  return (
    <header className="wesal-auth-minimal-header relative z-20" data-testid="auth-minimal-header">
      <div className="mx-auto flex h-14 w-full max-w-[92rem] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-6 xl:px-10">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/35"
          aria-label={t("brand.name")}
        >
          <WesalLogo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" variant="brand" />
          <span className="wesal-auth-brand-name truncate text-xl font-bold sm:text-2xl">
            {t("brand.name")}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-[var(--wesal-maroon)] transition hover:bg-white/40 hover:underline sm:px-3"
            data-testid="auth-back-home"
          >
            {t("nav.home")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
