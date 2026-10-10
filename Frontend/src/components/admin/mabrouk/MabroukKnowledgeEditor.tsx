"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n";
import { adminMabroukService } from "@/services/admin-mabrouk";
import type {
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeDraftSuggestion,
  SimulatorResult,
  VerificationStatus,
} from "@/types/mabrouk-knowledge";

type Props = {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onSaved: (article: KnowledgeArticle) => void;
};

type FormState = {
  key: string;
  title: string;
  category: string;
  answerAr: string;
  answerEn: string;
  source: string;
  priority: number;
  verificationStatus: VerificationStatus;
  effectiveFrom: string;
  effectiveUntil: string;
  reviewAt: string;
  overridesBuiltInKey: string;
  aliasesText: string;
  changeNote: string;
  aiInput: string;
};

function fromArticle(article: KnowledgeArticle | null): FormState {
  return {
    key: article?.key ?? "",
    title: article?.title ?? "",
    category: article?.category ?? "mabrouk",
    answerAr: article?.answerAr ?? "",
    answerEn: article?.answerEn ?? "",
    source: article?.source ?? "",
    priority: article?.priority ?? 10,
    verificationStatus: article?.verificationStatus === "Verified" ? "Verified" : "NeedsVerification",
    effectiveFrom: article?.effectiveFrom ?? "",
    effectiveUntil: article?.effectiveUntil ?? "",
    reviewAt: article?.reviewAt ?? "",
    overridesBuiltInKey: article?.overridesBuiltInKey ?? "",
    aliasesText: article?.aliases.map((alias) => alias.text).join("\n") ?? "",
    changeNote: "",
    aiInput: "",
  };
}

export default function MabroukKnowledgeEditor({ article, onClose, onSaved }: Props) {
  const t = useT();
  const [form, setForm] = useState<FormState>(() => fromArticle(article));
  const [editingId, setEditingId] = useState(article && !article.isBuiltIn ? article.id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<KnowledgeDraftSuggestion | null>(null);
  const [conflicts, setConflicts] = useState<{ severity: string; message: string }[]>([]);
  const [preview, setPreview] = useState<SimulatorResult | null>(null);


  const aliases = useMemo(
    () => form.aliasesText.split(/\r?\n/).map((text) => text.trim()).filter(Boolean),
    [form.aliasesText],
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildInput(): KnowledgeArticleInput {
    return {
      key: form.key,
      title: form.title,
      category: form.category,
      answerAr: form.answerAr,
      answerEn: form.answerEn || null,
      source: form.source,
      priority: Number(form.priority),
      verificationStatus: form.verificationStatus,
      effectiveFrom: form.effectiveFrom || null,
      effectiveUntil: form.effectiveUntil || null,
      reviewAt: form.reviewAt || null,
      overridesBuiltInKey: form.overridesBuiltInKey || null,
      aliases: aliases.map((text) => ({
        language: /[\u0600-\u06ff]/.test(text) ? "ar" : "en",
        text,
      })),
      changeNote: form.changeNote,
    };
  }

  async function persistDraft(): Promise<KnowledgeArticle | null> {
    setBusy(true);
    setError("");
    try {
      const result = editingId
        ? await adminMabroukService.updateKnowledge(editingId, buildInput())
        : await adminMabroukService.createKnowledge(buildInput());
      setEditingId(result.id);
      onSaved(result);
      return result;
    } catch {
      setError(t("admin.mabrouk.action.failure"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const saved = await persistDraft();
    if (saved) setError("");
  }

  async function createAiSuggestion() {
    setBusy(true);
    setError("");
    try {
      const result = await adminMabroukService.aiDraft(form.aiInput);
      setSuggestion(result);
      setField("title", result.title);
      setField("category", result.category || "mabrouk");
      setField("answerAr", result.answerAr);
      setField("answerEn", result.answerEn ?? "");
      setField("source", result.suggestedSource || "Admin review required");
      setField("verificationStatus", "NeedsVerification");
      setField("reviewAt", result.suggestedReviewDate ?? "");
      setField("aliasesText", [...result.aliasesAr, ...result.aliasesEn].join("\n"));
      const baseKey = result.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!form.key && baseKey) setField("key", baseKey);
      setConflicts(result.potentialConflicts.map((message) => ({ severity: "warning", message })));
    } catch {
      setError(t("admin.mabrouk.action.failure"));
    } finally {
      setBusy(false);
    }
  }

  async function previewDraft() {
    const saved = await persistDraft();
    if (!saved) return;
    setBusy(true);
    try {
      const question = aliases[0] ?? form.title;
      setPreview(await adminMabroukService.simulate(question, /[\u0600-\u06ff]/.test(question) ? "ar" : "en", true, saved.id));
    } catch {
      setError(t("admin.mabrouk.action.failure"));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const saved = await persistDraft();
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      const check = await adminMabroukService.conflictCheck(buildInput());
      setConflicts(check.conflicts);
      if (!check.canPublish) {
        setError(t("admin.mabrouk.editor.conflicts"));
        return;
      }
      if (!window.confirm(t("admin.mabrouk.editor.publishConfirm"))) return;
      const published = await adminMabroukService.publish(saved.id, form.changeNote);
      onSaved(published);
      onClose();
    } catch {
      setError(t("admin.mabrouk.action.failure"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5" role="presentation">
      <section
        className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mabrouk-editor-title"
        data-testid="mabrouk-knowledge-editor"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="mabrouk-editor-title" className="truncate text-lg font-bold text-[var(--wesal-maroon-dark)]">
              {article ? article.title : t("admin.mabrouk.editor.new")}
            </h2>
            {article?.hasUnpublishedDraft ? (
              <p className="mt-1 text-xs font-semibold text-[var(--wesal-muted)]">{t("admin.mabrouk.editor.pendingDraft")}</p>
            ) : null}
          </div>
          <button type="button" className="btn-outline min-h-9 px-3" onClick={onClose} aria-label={t("common.close")}>×</button>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <section className="rounded-2xl border border-[var(--wesal-border)] bg-[#fcfbf9] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--wesal-maroon-dark)]">{t("admin.mabrouk.editor.aiButton")}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--wesal-muted)]">{t("admin.mabrouk.editor.aiDisclaimer")}</p>
              </div>
              <button type="button" className="btn-outline" disabled={busy || form.aiInput.trim().length < 5} onClick={() => void createAiSuggestion()}>
                ✨ {t("admin.mabrouk.editor.aiButton")}
              </button>
            </div>
            <textarea
              className="mt-3 min-h-20 w-full resize-y rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--wesal-maroon)]"
              placeholder={t("admin.mabrouk.editor.aiInput")}
              value={form.aiInput}
              onChange={(event) => setField("aiInput", event.target.value)}
              maxLength={3000}
            />
            {suggestion ? <p className="mt-2 text-xs text-[var(--wesal-muted)]">{suggestion.confidenceNotes}</p> : null}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.mabrouk.editor.title")}>
              <input className={inputClass} maxLength={200} value={form.title} onChange={(event) => setField("title", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.key")}>
              <input className={inputClass} maxLength={120} value={form.key} onChange={(event) => setField("key", event.target.value)} dir="ltr" />
            </Field>
            <Field label={t("admin.mabrouk.editor.category")}>
              <input className={inputClass} maxLength={80} value={form.category} onChange={(event) => setField("category", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.source")}>
              <input className={inputClass} maxLength={500} value={form.source} onChange={(event) => setField("source", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.priority")}>
              <input className={inputClass} type="number" min={0} max={100} value={form.priority} onChange={(event) => setField("priority", Number(event.target.value))} />
            </Field>
            <Field label={t("admin.mabrouk.editor.verification")}>
              <select className={inputClass} value={form.verificationStatus} onChange={(event) => setField("verificationStatus", event.target.value as VerificationStatus)}>
                <option value="Verified">{t("admin.mabrouk.editor.verified")}</option>
                <option value="NeedsVerification">{t("admin.mabrouk.editor.needsVerification")}</option>
              </select>
            </Field>
            <Field label={t("admin.mabrouk.editor.answerAr")} className="sm:col-span-2">
              <textarea className={textareaClass} value={form.answerAr} onChange={(event) => setField("answerAr", event.target.value)} maxLength={12000} />
            </Field>
            <Field label={t("admin.mabrouk.editor.answerEn")} className="sm:col-span-2">
              <textarea className={textareaClass} dir="ltr" value={form.answerEn} onChange={(event) => setField("answerEn", event.target.value)} maxLength={12000} />
            </Field>
            <Field label={t("admin.mabrouk.editor.aliases")} className="sm:col-span-2">
              <textarea className="min-h-28 w-full resize-y rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--wesal-maroon)]" placeholder={t("admin.mabrouk.editor.addAlias")} value={form.aliasesText} onChange={(event) => setField("aliasesText", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.effectiveFrom")}>
              <input className={inputClass} type="date" value={form.effectiveFrom} onChange={(event) => setField("effectiveFrom", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.effectiveUntil")}>
              <input className={inputClass} type="date" value={form.effectiveUntil} onChange={(event) => setField("effectiveUntil", event.target.value)} />
            </Field>
            <Field label={t("admin.mabrouk.editor.reviewAt")}>
              <input className={inputClass} type="date" value={form.reviewAt} onChange={(event) => setField("reviewAt", event.target.value)} />
            </Field>
            {form.overridesBuiltInKey ? (
              <Field label={t("admin.mabrouk.knowledge.builtInBadge")}>
                <input className={inputClass} value={form.overridesBuiltInKey} readOnly dir="ltr" />
              </Field>
            ) : null}
            <Field label={t("admin.mabrouk.editor.changeNote")} className="sm:col-span-2">
              <input className={inputClass} value={form.changeNote} onChange={(event) => setField("changeNote", event.target.value)} maxLength={500} />
            </Field>
          </div>

          {conflicts.length > 0 ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" role="status">
              <h3 className="text-sm font-bold text-amber-900">{t("admin.mabrouk.editor.conflicts")}</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-amber-900">
                {conflicts.map((conflict, index) => <li key={index}>{conflict.message}</li>)}
              </ul>
            </section>
          ) : null}
          {error ? <p className="rounded-xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-maroon-dark)]" role="alert">{error}</p> : null}
          {preview ? (
            <section className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4" data-testid="mabrouk-draft-preview">
              <p className="text-xs font-bold text-[var(--wesal-muted)]">{t("admin.mabrouk.simulator.answer")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">{preview.answer}</p>
            </section>
          ) : null}

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--wesal-border)] pt-4">
            <button type="button" className="btn-outline" disabled={busy} onClick={onClose}>{t("admin.mabrouk.action.cancel")}</button>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void previewDraft()}>{t("admin.mabrouk.knowledge.preview")}</button>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void saveDraft()}>{t("admin.mabrouk.editor.saveDraft")}</button>
            <button type="button" className="btn-primary" disabled={busy || !editingId && !form.key} onClick={() => void publish()}>
              {t("admin.mabrouk.editor.publish")}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]";
const textareaClass = "min-h-28 w-full resize-y rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm leading-6 text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]";

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={"block space-y-1.5 " + className}>
      <span className="text-xs font-bold text-[var(--wesal-text)]">{label}</span>
      {children}
    </label>
  );
}
