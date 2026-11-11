"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatLockPeriodHours } from "@/lib/admin-moderation-mapper";

type PublishingRestrictionBannerProps = {
  lockedUntil: string | null;
  reason?: string | null;
  className?: string;
};

function formatPeriodFromUntil(
  lockedUntil: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
): string {
  if (!lockedUntil?.trim()) return t("admin.moderation.period.unknown");
  const end = new Date(lockedUntil);
  if (Number.isNaN(end.getTime())) return t("admin.moderation.period.unknown");
  const hours = Math.max(1, Math.ceil((end.getTime() - Date.now()) / 3_600_000));
  if (hours <= 720) return formatLockPeriodHours(hours, t);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(end);
}

/** Banner shown to restricted professionals on publish/edit surfaces. */
export default function PublishingRestrictionBanner({
  lockedUntil,
  reason,
  className = "",
}: PublishingRestrictionBannerProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const period = formatPeriodFromUntil(lockedUntil, t, locale);

  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl border border-[#f5c6c2] bg-[#fdecea] px-3.5 py-3 text-sm leading-6 text-[#912019] ${className}`.trim()}
      role="alert"
      data-testid="publishing-restriction-banner"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b42318] text-[0.65rem] font-bold text-white"
        aria-hidden="true"
      >
        !
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-bold">
          {t("moderation.restriction.banner", { period })}
        </p>
        {reason?.trim() ? (
          <p className="text-xs opacity-90">
            {t("moderation.restriction.reason", { reason: reason.trim() })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
