"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type { KnowledgeArticle, SimulatorResult } from "@/types/mabrouk-knowledge";

export default function MabroukSimulatorPage({ initialQuestion = "" }: { initialQuestion?: string }) {
  const t = useT();
  const [question, setQuestion] = useState(initialQuestion);
  const [fullAssistant, setFullAssistant] = useState(false);
  const [pagePath, setPagePath] = useState("");
  const [hallId, setHallId] = useState("");
  const [testDraft, setTestDraft] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [drafts, setDrafts] = useState<KnowledgeArticle[]>([]);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {

    void adminMabroukService.listKnowledge({ source: "dynamic" }).then((articles) => {
      setDrafts(articles.filter((article) => article.publicationStatus === "Draft" || article.hasUnpublishedDraft));
    }).catch(() => setError(true)).finally(() => setPageLoading(false));
  }, []);

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const language = /[\u0600-\u06ff]/.test(question) ? "ar" : "en";
      setResult(await adminMabroukService.simulate(
        question, language, testDraft, draftId || undefined, fullAssistant,
        pagePath.trim() || undefined, hallId.trim() || undefined));
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="mabrouk-simulator">
      <section>
        <h2 className="text-lg font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.simulator.title")}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">{t("admin.mabrouk.simulator.subtitle")}</p>
      </section>
      <form className="space-y-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5" onSubmit={(event) => void simulate(event)}>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-[var(--wesal-text)]">{t("admin.mabrouk.simulator.question")}</span>
          <textarea className="min-h-24 w-full resize-y rounded-xl border border-[var(--wesal-border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--wesal-maroon)]"
            value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} required />
        </label>

        <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[var(--wesal-text)]">
          <legend className="mb-2 text-xs font-bold">{t("admin.mabrouk.simulator.mode")}</legend>
          <label className="inline-flex min-h-10 items-center gap-2">
            <input type="radio" name="simulator-mode" checked={!fullAssistant}
              onChange={() => setFullAssistant(false)} />
            {t("admin.mabrouk.simulator.knowledgeOnly")}
          </label>
          <label className="inline-flex min-h-10 items-center gap-2">
            <input type="radio" name="simulator-mode" checked={fullAssistant}
              onChange={() => { setFullAssistant(true); setTestDraft(false); }} />
            {t("admin.mabrouk.simulator.fullAssistant")}
          </label>
        </fieldset>

        {fullAssistant ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--wesal-text)]">{t("admin.mabrouk.simulator.pagePath")}</span>
              <input className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] px-3 text-sm"
                value={pagePath} onChange={(event) => setPagePath(event.target.value)} maxLength={300}
                placeholder="/halls" dir="ltr" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--wesal-text)]">{t("admin.mabrouk.simulator.hallId")}</span>
              <input className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] px-3 text-sm"
                value={hallId} onChange={(event) => setHallId(event.target.value)} maxLength={36}
                dir="ltr" inputMode="text" />
            </label>
          </div>
        ) : (
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--wesal-text)]">
            <input type="checkbox" checked={testDraft} onChange={(event) => setTestDraft(event.target.checked)} />
            {t("admin.mabrouk.simulator.testDraft")}
          </label>
        )}

        {testDraft ? (
          <select className="min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm sm:max-w-xl"
            value={draftId} onChange={(event) => setDraftId(event.target.value)} required>
            <option value="">{pageLoading ? t("admin.mabrouk.loading") : t("admin.mabrouk.simulator.chooseDraft")}</option>
            {drafts.map((article) => (
              <option key={article.id} value={article.id}>{article.title} · {article.key}</option>
            ))}
          </select>
        ) : null}
        <button type="submit" className="btn-primary" disabled={loading || question.trim().length < 2 || testDraft && !draftId}>
          {loading ? t("admin.mabrouk.loading") : t("admin.mabrouk.simulator.run")}
        </button>
      </form>

      {error ? <p className="rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-maroon-dark)]" role="alert">{t("admin.mabrouk.error")}</p> : null}
      {result ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]" data-testid="mabrouk-simulator-result">
          <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6">
            <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.simulator.answer")}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]" dir="auto">{result.answer}</p>
          </section>
          <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6">
            <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.simulator.diagnostics")}</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <Diagnostic label={t("admin.mabrouk.simulator.source")} value={t("admin.mabrouk.source." + result.sourceType)} />
              <Diagnostic label={t("admin.mabrouk.simulator.article")} value={result.articleTitle ?? result.articleKey ?? t("admin.mabrouk.empty")} />
              {result.assistantKind ? <Diagnostic label={t("admin.mabrouk.simulator.assistantKind")} value={t("admin.mabrouk.simulator.kind." + result.assistantKind)} /> : null}
              <Diagnostic label={t("admin.mabrouk.knowledge.publication")} value={t("admin.mabrouk.status." + result.publicationStatus)} />
              <Diagnostic label={t("admin.mabrouk.knowledge.verification")} value={t("admin.mabrouk.verification." + result.verificationStatus)} />
              <Diagnostic label={t("admin.mabrouk.simulator.matched")} value={result.matchedAliases.join(" · ") || t("admin.mabrouk.empty")} />
              <Diagnostic label={t("admin.mabrouk.simulator.score")} value={result.score === null ? t("admin.mabrouk.empty") : String(result.score)} />
              <Diagnostic label={t("admin.mabrouk.simulator.gemini")} value={result.geminiUsed === null ? t("admin.mabrouk.simulator.notAvailable") : result.geminiUsed ? t("common.yes") : t("admin.mabrouk.simulator.notUsed")} />
              <Diagnostic label={t("admin.mabrouk.simulator.providerCalls")} value={result.providerCallCount === null ? t("admin.mabrouk.simulator.notAvailable") : String(result.providerCallCount)} />
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(6.5rem,0.65fr)_minmax(0,1fr)] gap-3 border-b border-[var(--wesal-border)] pb-2 last:border-0">
      <dt className="text-xs text-[var(--wesal-muted)]">{label}</dt>
      <dd className="break-words text-xs font-semibold text-[var(--wesal-text)]" dir="auto">{value}</dd>
    </div>
  );
}
