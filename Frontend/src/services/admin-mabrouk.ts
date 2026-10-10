import api from "@/lib/api";
import type {
  KnowledgeAnalytics,
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeConflict,
  KnowledgeDraftSuggestion,
  KnowledgeGap,
  KnowledgeGapSuggestion,
  KnowledgeOverview,
  KnowledgeRevision,
  SimulatorResult,
} from "@/types/mabrouk-knowledge";

const root = "/admin/mabrouk";

export const adminMabroukService = {
  async overview(): Promise<KnowledgeOverview> {
    return (await api.get<KnowledgeOverview>(root + "/overview")).data;
  },
  async listKnowledge(params?: Record<string, string>): Promise<KnowledgeArticle[]> {
    return (await api.get<KnowledgeArticle[]>(root + "/knowledge", { params })).data;
  },
  async getKnowledge(id: string): Promise<KnowledgeArticle> {
    return (await api.get<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id))).data;
  },
  async createKnowledge(input: KnowledgeArticleInput): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge", input)).data;
  },
  async updateKnowledge(id: string, input: KnowledgeArticleInput): Promise<KnowledgeArticle> {
    return (await api.put<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id), input)).data;
  },
  async publish(id: string, changeNote: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id) + "/publish", { changeNote })).data;
  },
  async archive(id: string, changeNote: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id) + "/archive", { changeNote })).data;
  },
  async markReviewed(id: string, nextReviewAt: string | null, changeNote: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id) + "/mark-reviewed", {
      nextReviewAt, changeNote,
    })).data;
  },
  async revisions(id: string): Promise<KnowledgeRevision[]> {
    return (await api.get<KnowledgeRevision[]>(root + "/knowledge/" + encodeURIComponent(id) + "/revisions")).data;
  },
  async rollback(id: string, revisionId: string, changeNote: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id) + "/rollback/" + encodeURIComponent(revisionId), {
      changeNote,
    })).data;
  },
  async createOverride(key: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/built-in/" + encodeURIComponent(key) + "/override")).data;
  },
  async duplicate(id: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/knowledge/" + encodeURIComponent(id) + "/duplicate")).data;
  },
  async aiDraft(roughInput: string, language?: string): Promise<KnowledgeDraftSuggestion> {
    return (await api.post<KnowledgeDraftSuggestion>(root + "/knowledge/ai-draft", { roughInput, language })).data;
  },
  async conflictCheck(input: KnowledgeArticleInput): Promise<{ conflicts: KnowledgeConflict[]; canPublish: boolean }> {
    return (await api.post<{ conflicts: KnowledgeConflict[]; canPublish: boolean }>(root + "/knowledge/conflict-check", input)).data;
  },
  async gaps(unresolvedOnly = true): Promise<KnowledgeGap[]> {
    return (await api.get<KnowledgeGap[]>(root + "/unanswered", { params: { unresolvedOnly } })).data;
  },
  async gapCount(): Promise<number> {
    return (await api.get<{ count: number }>(root + "/unanswered/count")).data.count;
  },
  async getGap(id: string): Promise<KnowledgeGap> {
    return (await api.get<KnowledgeGap>(root + "/unanswered/" + encodeURIComponent(id))).data;
  },
  async reviewGap(id: string): Promise<KnowledgeGap> {
    return (await api.post<KnowledgeGap>(root + "/unanswered/" + encodeURIComponent(id) + "/review")).data;
  },
  async ignoreGap(id: string): Promise<KnowledgeGap> {
    return (await api.post<KnowledgeGap>(root + "/unanswered/" + encodeURIComponent(id) + "/ignore")).data;
  },
  async linkGap(id: string, articleId: string): Promise<KnowledgeGap> {
    return (await api.post<KnowledgeGap>(root + "/unanswered/" + encodeURIComponent(id) + "/link", { articleId })).data;
  },
  async createArticleFromGap(id: string): Promise<KnowledgeArticle> {
    return (await api.post<KnowledgeArticle>(root + "/unanswered/" + encodeURIComponent(id) + "/create-article")).data;
  },
  async mergeGaps(targetClusterId: string, clusterIds: string[]): Promise<KnowledgeGap[]> {
    return (await api.post<KnowledgeGap[]>(root + "/unanswered/merge", { targetClusterId, clusterIds })).data;
  },
  async suggestGapGroups(): Promise<KnowledgeGapSuggestion[]> {
    return (await api.post<KnowledgeGapSuggestion[]>(root + "/unanswered/ai-cluster-suggestions")).data;
  },
  async simulate(
    question: string,
    language: string,
    testDraft = false,
    draftArticleId?: string,
    fullAssistant = false,
    pagePath?: string,
    hallId?: string,
  ): Promise<SimulatorResult> {
    return (await api.post<SimulatorResult>(root + "/simulate", {
      question, language, testDraft, draftArticleId: draftArticleId ?? null, fullAssistant,
      pagePath: pagePath ?? null, hallId: hallId ?? null,
    })).data;
  },
  async analytics(): Promise<KnowledgeAnalytics> {
    return (await api.get<KnowledgeAnalytics>(root + "/analytics")).data;
  },
  async exportJson(): Promise<unknown> {
    return (await api.get(root + "/export")).data;
  },
};
