"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeOverview } from "@/types/mabrouk-knowledge";

export default function MabroukOverviewPage() {
  const t = useT();
  const [data, setData] = useState<KnowledgeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await adminMabroukService.overview());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminMabroukService.overview()
      .then((result) => { if (active) { setData(result); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="seeker-pending-panel h-56 animate-pulse" aria-busy="true" data-testid="mabrouk-overview-loading" />;
  }
  if (error || !data) {
    return (
      <section className="seeker-pending-panel" role="alert">
        <p className="text-sm text-[var(--wesal-muted)]">{t("admin.mabrouk.error")}</p>
        <button type="button" className="btn-outline mt-4" onClick={() => void load()}>{t("admin.mabrouk.retry")}</button>
      </section>
    );
  }

  const metrics = [
    ["admin.mabrouk.metric.published", data.publishedDynamicKnowledge],
    ["admin.mabrouk.metric.drafts", data.drafts],
    ["admin.mabrouk.metric.builtIn", data.builtInArticles],
    ["admin.mabrouk.metric.gaps", data.unansweredClusters],
    ["admin.mabrouk.metric.occurrences", data.totalUnresolvedOccurrences],
    ["admin.mabrouk.metric.review", data.needsReview],
    ["admin.mabrouk.metric.expiring", data.expiringSoon],
  ] as const;

  return (
    <div className="space-y-5" data-testid="mabrouk-overview">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, count]) => (
          <article key={label} className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.04)] sm:p-5">
            <p className="text-xs font-semibold leading-5 text-[var(--wesal-muted)]">{t(label)}</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--wesal-maroon-dark)]">{count}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.sources.title")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SourceCard title={t("admin.mabrouk.knowledge.builtInBadge")} body={t("admin.mabrouk.sources.builtIn")} />
          <SourceCard title={t("admin.mabrouk.knowledge.dynamic")} body={t("admin.mabrouk.sources.dynamic")} />
          <SourceCard title={t("admin.mabrouk.knowledge.verification")} body={t("admin.mabrouk.sources.capabilities")} />
          <SourceCard title={t("admin.mabrouk.simulator.source")} body={t("admin.mabrouk.sources.live")} />
        </div>
        <p className="mt-4 rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm leading-6 text-[var(--wesal-text)]">
          {t("admin.mabrouk.sources.note")}
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <OverviewList
          title={t("admin.mabrouk.recentQuestions")}
          empty={data.recentUnanswered.length === 0}
          emptyText={t("admin.mabrouk.empty")}
        >
          {data.recentUnanswered.map((gap) => (
            <li key={gap.id} className="flex items-center justify-between gap-3 border-b border-[var(--wesal-border)] py-3 last:border-0">
              <span className="min-w-0 truncate text-sm text-[var(--wesal-text)]">{gap.canonicalQuestion}</span>
              <span className="shrink-0 rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wesal-maroon-dark)]">{gap.occurrenceCount}</span>
            </li>
          ))}
          <li className="pt-3">
            <Link className="text-sm font-bold text-[var(--wesal-maroon-dark)] hover:underline" href="/admin/mabrouk/unanswered">
              {t("admin.mabrouk.tab.unanswered")}
            </Link>
          </li>
        </OverviewList>

        <OverviewList
          title={t("admin.mabrouk.recentPublished")}
          empty={data.recentlyPublished.length === 0}
          emptyText={t("admin.mabrouk.empty")}
        >
          {data.recentlyPublished.map((article) => (
            <li key={article.id} className="border-b border-[var(--wesal-border)] py-3 last:border-0">
              <p className="text-sm font-semibold text-[var(--wesal-text)]">{article.title}</p>
              <p className="mt-1 text-xs text-[var(--wesal-muted)]">{article.category} · v{article.publishedVersion ?? article.currentVersion}</p>
            </li>
          ))}
          <li className="pt-3">
            <Link className="text-sm font-bold text-[var(--wesal-maroon-dark)] hover:underline" href="/admin/mabrouk/knowledge">
              {t("admin.mabrouk.tab.knowledge")}
            </Link>
          </li>
        </OverviewList>

        <OverviewList
          title={t("admin.mabrouk.needsReview")}
          empty={data.needsReviewArticles.length === 0}
          emptyText={t("admin.mabrouk.empty")}
        >
          {data.needsReviewArticles.map((article) => (
            <li key={article.id} className="border-b border-[var(--wesal-border)] py-3 last:border-0">
              <p className="text-sm font-semibold text-[var(--wesal-text)]">{article.title}</p>
              <p className="mt-1 text-xs text-[var(--wesal-muted)]">{article.reviewAt ?? article.verificationStatus}</p>
            </li>
          ))}
        </OverviewList>
      </div>
    </div>
  );
}

function SourceCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-[var(--wesal-border)] bg-[#fcfbf9] p-4">
      <h3 className="text-sm font-bold text-[var(--wesal-text)]">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[var(--wesal-muted)]">{body}</p>
    </article>
  );
}

function OverviewList({
  title, empty, emptyText, children,
}: {
  title: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
      <h2 className="text-base font-bold text-[var(--wesal-maroon-dark)]">{title}</h2>
      {empty ? <p className="py-6 text-sm text-[var(--wesal-muted)]">{emptyText}</p> : <ul className="mt-2">{children}</ul>}
    </section>
  );
}
