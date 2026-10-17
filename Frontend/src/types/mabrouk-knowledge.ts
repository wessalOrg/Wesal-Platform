export type KnowledgeStatus = "Draft" | "Published" | "Archived";
export type VerificationStatus = "Verified" | "NeedsVerification";
export type KnowledgeAlias = { id: string; language: "ar" | "en"; text: string };

export type KnowledgeArticle = {
  id: string;
  key: string;
  title: string;
  category: string;
  answerAr: string;
  answerEn: string | null;
  source: string;
  priority: number;
  publicationStatus: KnowledgeStatus | string;
  verificationStatus: VerificationStatus | string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  reviewAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  currentVersion: number;
  publishedVersion: number | null;
  overridesBuiltInKey: string | null;
  hasUnpublishedDraft: boolean;
  isBuiltIn: boolean;
  aliases: KnowledgeAlias[];
};

export type KnowledgeArticleInput = {
  key: string;
  title: string;
  category: string;
  answerAr: string;
  answerEn: string | null;
  source: string;
  priority: number;
  verificationStatus: VerificationStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  reviewAt: string | null;
  overridesBuiltInKey: string | null;
  aliases: { language: "ar" | "en"; text: string }[];
  changeNote: string;
};

export type KnowledgeRevision = {
  id: string;
  articleId: string;
  version: number;
  action: string;
  createdAt: string;
  createdByUserId: string | null;
  changeNote: string;
  snapshot: KnowledgeArticle;
};

export type KnowledgeGap = {
  id: string;
  canonicalQuestion: string;
  language: "ar" | "en";
  status: "New" | "Reviewed" | "Resolved" | "Ignored" | string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  reason: string;
  sampleQuestions: string[];
  linkedArticleId: string | null;
  resolvedAt: string | null;
  ignoredAt: string | null;
  mergedIntoClusterId: string | null;
};

export type KnowledgeOverview = {
  publishedDynamicKnowledge: number;
  drafts: number;
  builtInArticles: number;
  unansweredClusters: number;
  totalUnresolvedOccurrences: number;
  needsReview: number;
  expired: number;
  expiringSoon: number;
  resolvedClusters: number;
  recentUnanswered: KnowledgeGap[];
  recentlyPublished: KnowledgeArticle[];
  needsReviewArticles: KnowledgeArticle[];
};

export type KnowledgeConflict = {
  code: string;
  severity: "info" | "warning" | "block" | string;
  message: string;
  existingSource: string | null;
};

export type KnowledgeDraftSuggestion = {
  title: string;
  category: string;
  answerAr: string;
  answerEn: string | null;
  aliasesAr: string[];
  aliasesEn: string[];
  suggestedSource: string;
  suggestedReviewDate: string | null;
  potentialConflicts: string[];
  confidenceNotes: string;
};

export type SimulatorResult = {
  answer: string;
  sourceType: string;
  articleKey: string | null;
  articleTitle: string | null;
  publicationStatus: string;
  verificationStatus: string;
  matchedAliases: string[];
  score: number | null;
  geminiUsed: boolean | null;
  providerCallCount: number | null;
  draftOnly: boolean;
  assistantKind?: string | null;
};

export type KnowledgeAnalytics = {
  published: number;
  draft: number;
  builtIn: number;
  needsReview: number;
  expired: number;
  expiringSoon: number;
  unansweredClusters: number;
  totalUnresolvedOccurrences: number;
  resolvedClusters: number;
  topUnresolvedTopics: KnowledgeGap[];
  recentlyUpdated: KnowledgeArticle[];
};

export type KnowledgeGapSuggestion = {
  clusterIds: string[];
  explanation: string;
  confidence: number;
};
