"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { ADMIN_MABROUK_PATH } from "@/lib/account-profile-path";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeArticle, KnowledgeGap, KnowledgeGapSuggestion } from "@/types/mabrouk-knowledge";

export default function MabroukUnansweredPage() {
  const t = useT();
  const router = useRouter();
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [selected, setSelected] = useState<KnowledgeGap | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<KnowledgeGapSuggestion[]>([]);
  const [linkArticleId, setLinkArticleId] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [clusters, knowledge] = await Promise.all([
        adminMabroukService.gaps(!includeClosed),
        adminMabroukService.listKnowledge({ source: "dynamic", publicationStatus: "Published" }),
      ]);
      setGaps(clusters);
      setArticles(knowledge);
      setSelected((current) => current ? clusters.find((gap) => gap.id === current.id) ?? null : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [includeClosed]);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminMabroukService.gaps(!includeClosed),
      adminMabroukService.listKnowledge({ source: "dynamic", publicationStatus: "Published" }),
    ]).then(([clusters, knowledge]) => {
      if (!active) return;
      setGaps(clusters);
      setArticles(knowledge);
      setSelected((current) => current ? clusters.find((gap) => gap.id === current.id) ?? null : null);
      setError(false);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [includeClosed]);

  const unresolved = useMemo(() => gaps.filter((gap) => gap.status === "New" || gap.status === "Reviewed"), [gaps]);

  async function refreshSelected(action: () => Promise<KnowledgeGap>) {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await action();
      setSelected(updated);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function createAnswer() {
    if (!selected) return;
    setBusy(true);
    try {
      const article = await adminMabroukService.createArticleFromGap(selected.id);
      router.push(ADMIN_MABROUK_PATH + "/knowledge?edit=" + encodeURIComponent(article.id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function linkExisting() {
    if (!selected || !linkArticleId) return;
    await refreshSelected(() => adminMabroukService.linkGap(selected.id, linkArticleId));
  }

  async function suggestGroups() {
    setBusy(true);
    setError(false);
    try {
      setSuggestions(await adminMabroukService.suggestGapGroups());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function mergeIds(ids: string[]) {
    if (ids.length < 2) return;
    setBusy(true);
    try {
      await adminMabroukService.mergeGaps(ids[0], ids);
      setSelectedIds([]);
      setSuggestions([]);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function toggleId(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (loading && gaps.length === 0) {
    return <div className="seeker-pending-panel h-56 animate-pulse" aria-busy="true" data-testid="mabrouk-gaps-loading" />;
  }

  return (
    <div className="space-y-4" data-testid="mabrouk-unanswered">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.gaps.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">{t("admin.mabrouk.gaps.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm text-[var(--wesal-text)]">
            <input type="checkbox" checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} />
            {t("admin.mabrouk.gaps.showClosed")}
          </label>
          <button type="button" className="btn-outline" disabled={busy || unresolved.length < 2} onClick={() => void suggestGroups()}>
            ✨ {t("admin.mabrouk.gaps.suggestGroups")}
          </button>
          <button type="button" className="btn-outline" disabled={busy || selectedIds.length < 2} onClick={() => void mergeIds(selectedIds)}>
            {t("admin.mabrouk.gaps.merge")}
          </button>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-maroon-dark)]" role="alert">{t("admin.mabrouk.error")}</p> : null}

      {suggestions.length > 0 ? (
        <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.gaps.suggestedGroups")}</h3>
          <div className="mt-3 space-y-3">
            {suggestions.map((suggestion, index) => (
              <article key={index} className="rounded-xl bg-[var(--wesal-pink-soft)] p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-[var(--wesal-text)]">{suggestion.explanation}</p>
                  <p className="mt-1 text-xs text-[var(--wesal-muted)]">{suggestion.clusterIds.length} · {Math.round(suggestion.confidence * 100)}%</p>
                </div>
                <button type="button" className="btn-outline mt-3 shrink-0 sm:mt-0" disabled={busy} onClick={() => void mergeIds(suggestion.clusterIds)}>
                  {t("admin.mabrouk.gaps.merge")}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : unresolved.length > 1 ? (
        <p className="text-xs text-[var(--wesal-muted)]">{t("admin.mabrouk.gaps.noGroups")}</p>
      ) : null}

      {loading ? <div className="seeker-pending-panel h-28 animate-pulse" aria-busy="true" /> : null}
      {!loading && gaps.length === 0 ? <div className="seeker-pending-empty">{t("admin.mabrouk.empty")}</div> : null}

      {!loading && gaps.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.95fr)]">
          <section className="space-y-2" aria-label={t("admin.mabrouk.gaps.title")}>
            {gaps.map((gap) => {
              const active = selected?.id === gap.id;
              return (
                <article key={gap.id} className={"rounded-2xl border bg-white p-4 transition " +
                  (active ? "border-[var(--wesal-maroon)] shadow-[0_6px_20px_rgba(90,55,45,0.08)]" : "border-[var(--wesal-border)]")}>
                  <div className="flex items-start gap-3">
                    {gap.status === "New" || gap.status === "Reviewed" ? (
                      <input aria-label={t("admin.mabrouk.gaps.selectForMerge")} type="checkbox"
                        checked={selectedIds.includes(gap.id)} onChange={() => toggleId(gap.id)} className="mt-1" />
                    ) : <span className="w-4" />}
                    <button type="button" className="min-w-0 flex-1 text-start" onClick={() => { setSelected(gap); setLinkArticleId(gap.linkedArticleId ?? ""); }}>
                      <span className="block text-sm font-bold leading-6 text-[var(--wesal-text)]">{gap.canonicalQuestion}</span>
                      <span className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--wesal-muted)]">
                        <span>{t("admin.mabrouk.gaps.occurrences")}: {gap.occurrenceCount}</span>
                        <span>{t("admin.mabrouk.gaps.status")}: {t("admin.mabrouk.gapStatus." + gap.status)}</span>
                        <span>{gap.language.toUpperCase()}</span>
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {selected ? (
            <GapDetail
              gap={selected}
              articles={articles}
              linkArticleId={linkArticleId}
              setLinkArticleId={setLinkArticleId}
              busy={busy}
              onCreateAnswer={() => void createAnswer()}
              onReview={() => void refreshSelected(() => adminMabroukService.reviewGap(selected.id))}
              onIgnore={() => {
                if (window.confirm(t("admin.mabrouk.gaps.confirmIgnore"))) {
                  void refreshSelected(() => adminMabroukService.ignoreGap(selected.id));
                }
              }}
              onLink={() => void linkExisting()}
              t={t}
            />
          ) : (
            <div className="seeker-pending-empty">{t("admin.mabrouk.gaps.selectPrompt")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GapDetail({
  gap, articles, linkArticleId, setLinkArticleId, busy, onCreateAnswer, onReview, onIgnore, onLink, t,
}: {
  gap: KnowledgeGap;
  articles: KnowledgeArticle[];
  linkArticleId: string;
  setLinkArticleId: (value: string) => void;
  busy: boolean;
  onCreateAnswer: () => void;
  onReview: () => void;
  onIgnore: () => void;
  onLink: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <aside className="h-fit rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5" data-testid="mabrouk-gap-detail">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold leading-6 text-[var(--wesal-maroon-dark)]">{gap.canonicalQuestion}</h3>
        <span className="rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.gapStatus." + gap.status)}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <DetailField label={t("admin.mabrouk.gaps.occurrences")} value={String(gap.occurrenceCount)} />
        <DetailField label={t("admin.mabrouk.gaps.reason")} value={t("admin.mabrouk.gapReason." + gap.reason)} />
        <DetailField label={t("admin.mabrouk.gaps.firstSeen")} value={new Date(gap.firstSeenAt).toLocaleString()} />
        <DetailField label={t("admin.mabrouk.gaps.lastSeen")} value={new Date(gap.lastSeenAt).toLocaleString()} />
      </dl>
      <h4 className="mt-5 text-xs font-bold text-[var(--wesal-text)]">{t("admin.mabrouk.gaps.samples")}</h4>
      <ul className="mt-2 space-y-2">
        {gap.sampleQuestions.map((sample, index) => (
          <li key={index} className="rounded-xl bg-[#fcfbf9] px-3 py-2 text-sm leading-6 text-[var(--wesal-muted)]" dir="auto">{sample}</li>
        ))}
      </ul>
      {gap.status === "New" || gap.status === "Reviewed" ? (
        <div className="mt-5 space-y-2">
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={onCreateAnswer}>{t("admin.mabrouk.gaps.createAnswer")}</button>
          <div className="flex gap-2">
            <select className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--wesal-border)] bg-white px-2 text-xs"
              value={linkArticleId} onChange={(event) => setLinkArticleId(event.target.value)}>
              <option value="">{t("admin.mabrouk.gaps.selectArticle")}</option>
              {articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
            </select>
            <button type="button" className="btn-outline shrink-0 px-3" disabled={busy || !linkArticleId} onClick={onLink}>{t("admin.mabrouk.gaps.linkArticle")}</button>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" disabled={busy} onClick={onReview}>{t("admin.mabrouk.gaps.review")}</button>
            <button type="button" className="btn-outline flex-1" disabled={busy} onClick={onIgnore}>{t("admin.mabrouk.gaps.ignore")}</button>
          </div>
        </div>
      ) : null}
      {gap.linkedArticleId ? <p className="mt-3 break-all text-xs text-[var(--wesal-muted)]">{t("admin.mabrouk.gaps.linkedArticle")}: {gap.linkedArticleId}</p> : null}
    </aside>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--wesal-muted)]">{label}</dt><dd className="mt-1 break-words font-semibold text-[var(--wesal-text)]">{value}</dd></div>;
}
