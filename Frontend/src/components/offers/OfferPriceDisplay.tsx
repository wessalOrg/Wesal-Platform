"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatOfferAmount } from "@/lib/offer-format";

type OfferPriceDisplayProps = {
  oldPrice: number | null | undefined;
  offerPrice: number | null | undefined;
  /** Larger offer price for management cards. */
  size?: "sm" | "md" | "lg";
  className?: string;
  showCurrency?: boolean;
};

export default function OfferPriceDisplay({
  oldPrice,
  offerPrice,
  size = "md",
  className = "",
  showCurrency = true,
}: OfferPriceDisplayProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const currency = showCurrency ? ` ${t("offers.currency")}` : "";
  const offerClass =
    size === "lg"
      ? "text-2xl font-extrabold"
      : size === "sm"
        ? "text-sm font-bold"
        : "text-lg font-extrabold";

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`.trim()}>
      {offerPrice != null ? (
        <span className={`${offerClass} text-[var(--wesal-maroon)] tabular-nums`}>
          {formatOfferAmount(offerPrice, locale)}
          {currency}
        </span>
      ) : null}
      {oldPrice != null && oldPrice > 0 ? (
        <span className="text-xs text-[var(--wesal-muted)] line-through tabular-nums sm:text-sm">
          {formatOfferAmount(oldPrice, locale)}
          {currency}
        </span>
      ) : null}
    </div>
  );
}
