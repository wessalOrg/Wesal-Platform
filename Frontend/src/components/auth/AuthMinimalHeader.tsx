"use client";

import Link from "next/link";
import WesalBrandLockup from "@/components/brand/WesalBrandLockup";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useT } from "@/i18n";

export default function AuthMinimalHeader() {
  const t = useT();

  return (
    <header className="wesal-auth-minimal-header relative z-20" data-testid="auth-minimal-header">
      <div className="relative mx-auto flex h-14 w-full max-w-[92rem] items-center px-4 sm:h-16 sm:px-6 lg:px-6 xl:px-10">
        <div className="absolute left-4 flex min-w-0 flex-row items-center gap-2 sm:left-6 sm:gap-3 lg:left-6 xl:left-10">
          <WesalBrandLockup logoClassName="h-8 w-auto sm:h-9" />
          <LanguageSwitcher />
        </div>

        <Link
          href="/"
          className="absolute right-4 inline-flex max-w-[min(100%,14rem)] flex-row items-center gap-1.5 rounded-xl px-1.5 py-2 text-sm font-semibold text-[var(--wesal-maroon-dark)] transition hover:bg-white/40 sm:right-6 sm:max-w-none sm:gap-2 sm:px-2.5 lg:right-6 xl:right-10"
          data-testid="auth-back-home"
        >
          <span className="truncate">{t("common.backHome")}</span>
          <BackHomeArrow />
        </Link>
      </div>
    </header>
  );
}

function BackHomeArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
