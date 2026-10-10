"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeAnalytics } from "@/types/mabrouk-knowledge";

export default function MabroukAnalyticsPage() {
  const t = useT();
  const [data, setData] = useState<KnowledgeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setData(await adminMabroukService.analytics()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    adminMabroukService.analytics()
      .then((result) => { if (active) { setData(result); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function exportData() {
    setExporting(true);
    try {
      const payload = await adminMabroukService.exportJson();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mabrouk-knowledge-export.json";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch { setError(true); }
    finally { setExporting(false); }
  }

  if (loading) return <div className="seeker-pending-panel h-56 animate-pulse" aria-busy="true" data-testid="mabrouk-analytics-loading" />;
  if (error || !data) {
    return <section className="seeker-pending-panel" role="alert"><p className="text-sm text-[var(--wesal-muted)]">{t("admin.mabrouk.error")}</p><button className="btn-outline mt-4" onClick={() => void load()}>{t("admin.mabrouk.retry")}</button></section>;
  }

  const metrics = [
    ["admin.mabrouk.metric.published", data.published],
    ["admin.mabrouk.metric.drafts", data.draft],
    ["admin.mabrouk.metric.builtIn", data.builtIn],
    ["admin.mabrouk.metric.review", data.needsReview],
    ["admin.mabrouk.metric.expired", data.expired],
    ["admin.mabrouk.metric.expiring", data.expiringSoon],
    ["admin.mabrouk.metric.gaps", data.unansweredClusters],
    ["admin.mabrouk.metric.occurrences", data.totalUnresolvedOccurrences],
    ["admin.mabrouk.metric.resolved", data.resolvedClusters],
  ] as const;

  return (
    <div className="space-y-5" data-testid="mabrouk-analytics">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.analytics.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">{t("admin.mabrouk.analytics.noUsageTracking")}</p>
        </div>
        <button type="button" className="btn-outline" disabled={exporting} onClick={() => void exportData()}>{t("admin.mabrouk.analytics.export")}</button>
      </section>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.04)]">
            <p className="text-xs font-semibold leading-5 text-[var(--wesal-muted)]">{t(label)}</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--wesal-maroon-dark)]">{value}</p>
          </article>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.analytics.topGaps")}</h3>
          {data.topUnresolvedTopics.length === 0 ? <p className="mt-4 text-sm text-[var(--wesal-muted)]">{t("admin.mabrouk.empty")}</p> : (
            <ul className="mt-2 divide-y divide-[var(--wesal-border)]">
              {data.topUnresolvedTopics.map((gap) => <li key={gap.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 text-sm text-[var(--wesal-text)]">{gap.canonicalQuestion}</span>
                <span className="rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wesal-maroon-dark)]">{gap.occurrenceCount}</span>
              </li>)}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.analytics.updated")}</h3>
          {data.recentlyUpdated.length === 0 ? <p className="mt-4 text-sm text-[var(--wesal-muted)]">{t("admin.mabrouk.empty")}</p> : (
            <ul className="mt-2 divide-y divide-[var(--wesal-border)]">
              {data.recentlyUpdated.map((article) => <li key={article.id} className="py-3">
                <p className="text-sm font-semibold text-[var(--wesal-text)]">{article.title}</p>
                <p className="mt-1 text-xs text-[var(--wesal-muted)]">{t("admin.mabrouk.status." + article.publicationStatus)} · {new Date(article.updatedAt).toLocaleDateString()}</p>
              </li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
