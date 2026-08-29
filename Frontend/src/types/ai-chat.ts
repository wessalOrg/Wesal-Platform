/** Visual tone of an assistant bubble — help/fallback stay distinct from a normal reply. */
export type AiChatVariant = "default" | "help" | "fallback" | "error";

export type AiChatRole = "user" | "assistant";

/** Per-bubble language from the API, or null when the UI should infer from text. */
export type AiChatTextLang = "ar" | "en";

export type AiRecommendedHall = {
  hallId: string;
  hallName: string;
  region: string | null;
  address: string | null;
  capacity: number | null;
  price: number | null;
  mainImage: string | null;
  isAvailable: boolean;
  unavailableReason: string | null;
};

/** Criteria the recommend endpoint extracted from the user's question. */
export type AiExtractedCriteria = {
  region: string | null;
  area: string | null;
  date: string | null;
  bookingPeriod: string | null;
  capacity: number | null;
};

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  text: string;
  createdAt: string;
  variant: AiChatVariant;
  halls: AiRecommendedHall[];
  recommendationStatus: RecommendationStatus | null;
  criteria: AiExtractedCriteria | null;
  /** Backend `responseLanguage` when present; user turns stay null and are inferred. */
  lang: AiChatTextLang | null;
  /** How-to category from `/how-to` (e.g. payment, booking). Null for recommend turns. */
  category: string | null;
};

export type AiChatSendState = "idle" | "sending" | "success" | "error";

/**
 * What the chat shell should emphasise. Session-level unavailable stays in the
 * panel; this is the conversation surface once a session exists.
 */
export type AiChatSurface = "idle" | "loading" | "empty" | "failure";

export type RecommendationStatus =
  | "Success"
  | "IncompleteCriteria"
  | "NoResults"
  | "AiUnavailable";
