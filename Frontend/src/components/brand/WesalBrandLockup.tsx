"use client";

import Link from "next/link";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";

type WesalBrandLockupProps = {
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  href?: string;
};

/**
 * Site brand: mark + وِصال name in site maroon.
 */
export default function WesalBrandLockup({
  className = "",
  logoClassName = "h-9 w-auto sm:h-10",
  nameClassName = "text-lg sm:text-xl",
  href = "/",
}: WesalBrandLockupProps) {
  const t = useT();
  const name = t("brand.name");

  return (
    <Link
      href={href}
      className={`wesal-brand-lockup inline-flex min-w-0 shrink-0 items-center gap-2 text-[var(--wesal-maroon)] ${className}`.trim()}
      aria-label={name}
      data-testid="wesal-brand-lockup"
    >
      <WesalLogo
        className={`shrink-0 ${logoClassName}`}
        variant="brand"
        title={name}
      />
      <span className={`truncate font-bold text-current ${nameClassName}`}>
        {name}
      </span>
    </Link>
  );
}
