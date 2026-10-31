"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MabroukKnowledgeEditor from "@/components/admin/mabrouk/MabroukKnowledgeEditor";
import WesalSelect from "@/components/ui/WesalSelect";
import { useT } from "@/i18n";
import { ADMIN_MABROUK_PATH } from "@/lib/account-profile-path";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeArticle } from "@/types/mabrouk-knowledge";

export default function MabroukKnowledgeLibraryPage() {
  const t = useT();
  const router = useRouter();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [source, setSource] = useState("");
  const [publication, setPublication] = useState("");
  const [verification, setVerification] = useState("");
  const [category, setCategory] = useState("");
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");

  const query = useMemo(() => {
    const params: Record<string, string> = {};
    if (appliedSearch.trim()) params.search = appliedSearch.trim();
    if (source) params.source = source;
    if (publication) params.publicationStatus = publication;
    if (verification) params.verificationStatus = verification;
    if (category) params.category = category;
    if (review) params.review = review;
    return params;
  }, [appliedSearch, source, publication, verification, category, review]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setArticles(await adminMabroukService.listKnowledge(query));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let active = true;
    adminMabroukService.listKnowledge(query)
      .then((items) => { if (active) { setArticles(items); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("edit");
    if (!id) return;
    void adminMabroukService.getKnowledge(id).then((article) => {
      setSelected(article);
      setEditorOpen(true);
    }).catch(() => setError(true));
  }, []);

  const categories = useMemo(
    () => [...new Set(articles.map((article) => article.category).filter(Boolean))].sort(),
    [articles],
  );

  async function openEditor(id: string) {
    try {
      setSelected(await adminMabroukService.getKnowledge(id));
      setEditorOpen(true);
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  async function publish(article: KnowledgeArticle) {
    const message = article.verificationStatus === "Verified"
      ? t("admin.mabrouk.editor.publishConfirm")
      : t("admin.mabrouk.editor.publishUnverifiedConfirm");
    if (!window.confirm(message)) return;
    try {
      await adminMabroukService.publish(article.id, "Published from the Knowledge Library.");
      setNotice(t("admin.mabrouk.action.success"));
      await load();
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  async function archive(article: KnowledgeArticle) {
    if (!window.confirm(t("admin.mabrouk.knowledge.confirmArchive"))) return;
    try {
      await adminMabroukService.archive(article.id, "Archived from the Knowledge Library.");
      setNotice(t("admin.mabrouk.action.success"));
      await load();
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  async function createOverride(article: KnowledgeArticle) {
    try {
      const created = await adminMabroukService.createOverride(article.key);
      setSelected(created);
      setEditorOpen(true);
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  async function duplicate(article: KnowledgeArticle) {
    try {
      const created = await adminMabroukService.duplicate(article.id);
      setSelected(created);
      setEditorOpen(true);
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  async function markReviewed(article: KnowledgeArticle) {
    try {
      await adminMabroukService.markReviewed(article.id, null, "Review completed from the Knowledge Library.");
      setNotice(t("admin.mabrouk.action.success"));
      await load();
    } catch {
      setNotice(t("admin.mabrouk.action.failure"));
    }
  }

  return (
    <div className="space-y-4" data-testid="mabrouk-knowledge-library">
      <section className="space-y-3">
        <div className="px-1.5">
          <h2 className="text-lg font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.knowledge.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">{t("admin.mabrouk.knowledge.subtitle")}</p>
        </div>
        <div className="px-1.5 md:flex md:justify-end md:px-0">
          <button
            type="button"
            className="btn-primary w-full justify-center md:w-auto"
            onClick={() => { setSelected(null); setEditorOpen(true); }}
          >
            + {t("admin.mabrouk.knowledge.create")}
          </button>
        </div>
      </section>

      <form
        className="mabrouk-library-filters grid gap-2 rounded-2xl border border-[var(--wesal-border)] bg-white p-3 sm:grid-cols-2 xl:grid-cols-6"
        onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}
      >
        <input className="min-h-11 rounded-xl border border-[var(--wesal-border)] px-3 text-center text-sm outline-none focus:border-[var(--wesal-maroon)] sm:col-span-2 sm:text-start xl:col-span-2"
          placeholder={t("admin.mabrouk.knowledge.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <FilterSelect
          label={t("admin.mabrouk.knowledge.source")}
          value={source}
          onChange={setSource}
          options={[
            { value: "", label: t("admin.mabrouk.knowledge.allSources") },
            { value: "dynamic", label: t("admin.mabrouk.knowledge.dynamic") },
            { value: "builtin", label: t("admin.mabrouk.knowledge.builtInBadge") },
          ]}
        />
        <FilterSelect
          label={t("admin.mabrouk.knowledge.publication")}
          value={publication}
          onChange={setPublication}
          options={[
            { value: "", label: t("admin.mabrouk.knowledge.all") },
            { value: "Draft", label: t("admin.mabrouk.status.Draft") },
            { value: "Published", label: t("admin.mabrouk.status.Published") },
            { value: "Archived", label: t("admin.mabrouk.status.Archived") },
          ]}
        />
        <FilterSelect
          label={t("admin.mabrouk.knowledge.verification")}
          value={verification}
          onChange={setVerification}
          options={[
            { value: "", label: t("admin.mabrouk.knowledge.all") },
            { value: "Verified", label: t("admin.mabrouk.editor.verified") },
            { value: "NeedsVerification", label: t("admin.mabrouk.editor.needsVerification") },
          ]}
        />
        <FilterSelect
          label={t("admin.mabrouk.knowledge.category")}
          value={category}
          onChange={setCategory}
          options={[
            { value: "", label: t("admin.mabrouk.knowledge.all") },
            ...categories.map((item) => ({ value: item, label: item })),
          ]}
        />
        <FilterSelect
          label={t("admin.mabrouk.knowledge.review")}
          value={review}
          onChange={setReview}
          options={[
            { value: "", label: t("admin.mabrouk.knowledge.all") },
            { value: "current", label: t("admin.mabrouk.knowledge.current") },
            { value: "review-due", label: t("admin.mabrouk.knowledge.reviewDue") },
            { value: "expiring", label: t("admin.mabrouk.knowledge.expiring") },
            { value: "expired", label: t("admin.mabrouk.knowledge.expired") },
          ]}
        />
        <button type="submit" className="btn-outline min-h-11 w-full justify-center">{t("admin.mabrouk.knowledge.applyFilters")}</button>
      </form>

      {notice ? <p className="rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-maroon-dark)]" role="status">{notice}</p> : null}
      {loading ? <div className="seeker-pending-panel h-56 animate-pulse" aria-busy="true" data-testid="mabrouk-library-loading" /> : null}
      {error ? (
        <section className="seeker-pending-panel" role="alert">
          <p className="text-sm text-[var(--wesal-muted)]">{t("admin.mabrouk.error")}</p>
          <button type="button" className="btn-outline mt-4" onClick={() => void load()}>{t("admin.mabrouk.retry")}</button>
        </section>
      ) : null}
      {!loading && !error && articles.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="mabrouk-library-empty">{t("admin.mabrouk.empty")}</div>
      ) : null}
      {!loading && !error && articles.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {articles.map((article) => (
            <KnowledgeCard
              key={article.isBuiltIn ? article.key : article.id}
              article={article}
              onEdit={() => void openEditor(article.id)}
              onPreview={() => router.push(ADMIN_MABROUK_PATH + "/simulator?question=" + encodeURIComponent(article.aliases[0]?.text ?? article.title))}
              onHistory={() => router.push(ADMIN_MABROUK_PATH + "/history?article=" + encodeURIComponent(article.id))}
              onPublish={() => void publish(article)}
              onArchive={() => void archive(article)}
              onOverride={() => void createOverride(article)}
              onDuplicate={() => void duplicate(article)}
              onReview={() => void markReviewed(article)}
              t={t}
            />
          ))}
        </div>
      ) : null}

      {editorOpen ? (
        <MabroukKnowledgeEditor
          article={selected}
          onClose={() => { setEditorOpen(false); setSelected(null); }}
          onSaved={(saved) => { setSelected(saved); void load(); }}
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <WesalSelect
      label={label}
      labelHidden
      value={value}
      onChange={onChange}
      options={options}
      triggerClassName="mabrouk-library-filter flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--wesal-border)] bg-white px-2.5 text-center text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]"
    />
  );
}

const actionBtnClass =
  "btn-outline box-border min-h-10 w-full min-w-0 justify-center px-2 text-center text-[0.8rem] last:odd:col-span-2 md:min-h-9";
const actionPrimaryBtnClass =
  "btn-primary box-border min-h-10 w-full min-w-0 justify-center px-2 text-center text-[0.8rem] last:odd:col-span-2 md:min-h-9";

function KnowledgeCard({
  article, onEdit, onPreview, onHistory, onPublish, onArchive, onOverride, onDuplicate, onReview, t,
}: {
  article: KnowledgeArticle;
  onEdit: () => void;
  onPreview: () => void;
  onHistory: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onOverride: () => void;
  onDuplicate: () => void;
  onReview: () => void;
  t: ReturnType<typeof useT>;
}) {
  const statusLabel = t("admin.mabrouk.status." + article.publicationStatus);
  const verificationLabel = t("admin.mabrouk.verification." + article.verificationStatus);
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.04)] sm:p-5">
      <header className="min-w-0">
        <h3 className="break-words text-base font-bold text-[var(--wesal-text)]">{article.title}</h3>
        <p className="mt-1 break-all text-xs text-[var(--wesal-muted)]" dir="ltr">{article.key}</p>
      </header>
      <div className="mt-3 grid w-full grid-cols-3 gap-1.5 px-1">
        <Badge>{article.isBuiltIn ? t("admin.mabrouk.knowledge.builtInBadge") : t("admin.mabrouk.knowledge.dynamic")}</Badge>
        <Badge>{statusLabel}</Badge>
        <Badge>{verificationLabel}</Badge>
      </div>
      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[var(--wesal-muted)]">{article.answerAr || t("admin.mabrouk.editor.draftOnly")}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--wesal-muted)]">
        <span>{t("admin.mabrouk.editor.category")}: {article.category}</span>
        <span>{t("admin.mabrouk.editor.aliases")}: {article.aliases.length}</span>
        {article.effectiveUntil ? <span>{t("admin.mabrouk.editor.effectiveUntil")}: {article.effectiveUntil}</span> : null}
        {article.reviewAt ? <span>{t("admin.mabrouk.editor.reviewAt")}: {article.reviewAt}</span> : null}
        {article.overridesBuiltInKey ? <span dir="ltr">{article.overridesBuiltInKey}</span> : null}
      </div>
      {article.hasUnpublishedDraft ? <p className="mt-2 text-xs font-semibold text-amber-800">{t("admin.mabrouk.editor.pendingDraft")}</p> : null}
      <div className="mt-4 grid w-full grid-cols-2 gap-2 px-1">
        <button type="button" className={actionBtnClass} onClick={onPreview}>{t("admin.mabrouk.knowledge.preview")}</button>
        {article.isBuiltIn ? (
          <button type="button" className={actionBtnClass} onClick={onOverride}>{t("admin.mabrouk.knowledge.override")}</button>
        ) : (
          <>
            <button type="button" className={actionBtnClass} onClick={onEdit}>{t("admin.mabrouk.knowledge.edit")}</button>
            {article.publicationStatus === "Draft" || article.hasUnpublishedDraft ? (
              <button type="button" className={actionPrimaryBtnClass} onClick={onPublish}>{t("admin.mabrouk.knowledge.publish")}</button>
            ) : null}
            {article.publicationStatus === "Published" && article.reviewAt && new Date(article.reviewAt) <= new Date() ? (
              <button type="button" className={actionBtnClass} onClick={onReview}>{t("admin.mabrouk.knowledge.reviewDue")}</button>
            ) : null}
            {article.publicationStatus !== "Archived" ? (
              <button type="button" className={actionBtnClass} onClick={onArchive}>{t("admin.mabrouk.knowledge.archive")}</button>
            ) : null}
            <button type="button" className={actionBtnClass} onClick={onDuplicate}>{t("admin.mabrouk.knowledge.duplicate")}</button>
            <button type="button" className={actionBtnClass} onClick={onHistory}>{t("admin.mabrouk.knowledge.history")}</button>
          </>
        )}
      </div>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 w-full min-w-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] px-1.5 py-1 text-center text-[0.62rem] font-bold leading-4 whitespace-normal break-words text-[var(--wesal-maroon-dark)]">
      {children}
    </span>
  );
}
