"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import "./offer-date-range.css";

export default function OfferDateRange({ startsAt, endsAt }: {
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const lang = useUiLang();
  const t = useT();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const entries = [["offers.form.startsAt", startsAt], ["offers.form.endsAt", endsAt]] as const;
  const dates = entries.flatMap(([label, value]) => {
    if (!value) return [];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? [] : [{ label, value, date }];
  });
  if (!dates.length) return null;

  return <div className="offer-date-range">
    {dates.map(({ label, value, date }) => <div className="offer-date-range-row" key={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
      <div className="offer-date-range-details">
        <span className="offer-date-range-label">{t(label)}</span>
        <time dateTime={value}>
          <bdi>{new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date)}</bdi>
          <span className="offer-date-range-separator" aria-hidden="true">|</span>
          <bdi>{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date)}</bdi>
        </time>
      </div>
    </div>)}
  </div>;
}
