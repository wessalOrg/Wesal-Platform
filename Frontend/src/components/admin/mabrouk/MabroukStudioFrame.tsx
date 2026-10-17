"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n";
import { ADMIN_MABROUK_PATH } from "@/lib/account-profile-path";

const tabs = [
  { path: ADMIN_MABROUK_PATH, key: "admin.mabrouk.tab.overview" },
  { path: ADMIN_MABROUK_PATH + "/knowledge", key: "admin.mabrouk.tab.knowledge" },
  { path: ADMIN_MABROUK_PATH + "/unanswered", key: "admin.mabrouk.tab.unanswered" },
  { path: ADMIN_MABROUK_PATH + "/simulator", key: "admin.mabrouk.tab.simulator" },
  { path: ADMIN_MABROUK_PATH + "/analytics", key: "admin.mabrouk.tab.analytics" },
  { path: ADMIN_MABROUK_PATH + "/history", key: "admin.mabrouk.tab.history" },
] as const;

export default function MabroukStudioFrame({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div className="seeker-home space-y-5" data-testid="mabrouk-knowledge-studio">
      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--wesal-pink)] text-[var(--wesal-maroon-dark)]">
              <MabroukMark />
            </span>
            <div>
              <h1 className="seeker-welcome-title">{t("admin.mabrouk.title")}</h1>
              <p className="seeker-welcome-body">{t("admin.mabrouk.subtitle")}</p>
            </div>
          </div>
        </div>
      </section>

      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--wesal-border)] bg-white p-1"
        aria-label={t("admin.mabrouk.title")}
        data-testid="mabrouk-studio-tabs"
      >
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              aria-current={active ? "page" : undefined}
              className={"min-h-10 shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 " +
                (active
                  ? "bg-[var(--wesal-maroon)] text-white"
                  : "text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-maroon-dark)]")}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function MabroukMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M12 3.5a3.5 3.5 0 0 0-6.7 1.4A3.8 3.8 0 0 0 3 8.2a3.8 3.8 0 0 0 1.3 2.9A3.6 3.6 0 0 0 6 17.5V20h5v-3H9.5v-3H12v-3H9V8h3V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3.5a3.5 3.5 0 0 1 6.7 1.4A3.8 3.8 0 0 1 21 8.2a3.8 3.8 0 0 1-1.3 2.9 3.6 3.6 0 0 1-1.7 6.4V20h-5v-3h1.5v-3H12v-3h3V8h-3V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
