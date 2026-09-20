"use client";

import Link from "next/link";
import WesalBrandLockup from "@/components/brand/WesalBrandLockup";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useT } from "@/i18n";

export default function AuthMinimalHeader() {
  const t = useT();

  return (
    <header className="wesal-auth-minimal-header relative z-20" data-testid="auth-minimal-header">
      <div className="mx-auto flex h-14 w-full max-w-[92rem] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-6 xl:px-10">
        <WesalBrandLockup logoClassName="h-8 w-auto sm:h-9" />

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-[var(--wesal-maroon-dark)] transition hover:bg-white/40 hover:underline sm:px-3"
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
