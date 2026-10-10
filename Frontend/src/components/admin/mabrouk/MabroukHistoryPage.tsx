"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeArticle, KnowledgeRevision } from "@/types/mabrouk-knowledge";

export default function MabroukHistoryPage() {
  const t = useT();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [articleId, setArticleId] = useState("");
  const [revisions, setRevisions] = useState<KnowledgeRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialId = params.get("article") ?? "";
    void adminMabroukService.listKnowledge({ source: "dynamic" }).then((items) => {
      setArticles(items);
      if (initialId && items.some((item) => item.id === initialId)) setArticleId(initialId);
      else if (items[0]) setArticleId(items[0].id);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const loadRevisions = useCallback(async () => {
    if (!articleId) {
      setRevisions([]);
      return;
    }
    try {
      setRevisions(await adminMabroukService.revisions(articleId));
      setError(false);
    } catch {
      setError(true);
    }
  }, [articleId]);

  useEffect(() => {
    if (!articleId) return;
    let active = true;
    adminMabroukService.revisions(articleId)
      .then((items) => { if (active) { setRevisions(items); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [articleId]);

  async function rollback(revision: KnowledgeRevision) {
    if (!window.confirm(t("admin.mabrouk.history.confirmRollback"))) return;
    const note = "Rollback to version " + revision.version + " from Knowledge Studio history.";
    setBusy(true);
    try {
      await adminMabroukService.rollback(articleId, revision.id, note);
      await Promise.all([loadRevisions(), adminMabroukService.listKnowledge({ source: "dynamic" }).then(setArticles)]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="seeker-pending-panel h-48 animate-pulse" aria-busy="true" data-testid="mabrouk-history-loading" />;

  return (
    <div className="space-y-4" data-testid="mabrouk-history">
      <section>
        <h2 className="text-lg font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.history.title")}</h2>
      </section>
      {error ? <p className="rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-maroon-dark)]" role="alert">{t("admin.mabrouk.error")}</p> : null}
      <label className="block max-w-2xl space-y-1.5">
        <span className="text-xs font-bold text-[var(--wesal-text)]">{t("admin.mabrouk.editor.title")}</span>
        <select className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm"
          value={articleId} onChange={(event) => setArticleId(event.target.value)}>
          {articles.map((article) => <option key={article.id} value={article.id}>{article.title} · {article.key}</option>)}
        </select>
      </label>
      {revisions.length === 0 ? <div className="seeker-pending-empty">{t("admin.mabrouk.empty")}</div> : (
        <section className="space-y-3">
          {revisions.map((revision) => (
            <article key={revision.id} className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--wesal-text)]">
                    {t("admin.mabrouk.history.version")} {revision.version} · {t("admin.mabrouk.actionName." + revision.action)}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--wesal-muted)]">
                    {t("admin.mabrouk.history.changedBy")}: {revision.createdByUserId ?? t("admin.role")} · {new Date(revision.createdAt).toLocaleString()}
                  </p>
                  {revision.changeNote ? <p className="mt-2 text-sm text-[var(--wesal-muted)]">{revision.changeNote}</p> : null}
                </div>
                <button type="button" className="btn-outline" disabled={busy} onClick={() => void rollback(revision)}>
                  {t("admin.mabrouk.history.rollback")}
                </button>
              </div>
              <details className="mt-4 rounded-xl bg-[#fcfbf9] p-3">
                <summary className="cursor-pointer text-xs font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.history.viewVersion")}</summary>
                <div className="mt-3 space-y-3 text-sm">
                  <p className="font-semibold text-[var(--wesal-text)]">{revision.snapshot.title}</p>
                  <p className="whitespace-pre-wrap leading-6 text-[var(--wesal-muted)]">{revision.snapshot.answerAr}</p>
                  {revision.snapshot.answerEn ? <p className="whitespace-pre-wrap leading-6 text-[var(--wesal-muted)]" dir="ltr">{revision.snapshot.answerEn}</p> : null}
                </div>
              </details>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
