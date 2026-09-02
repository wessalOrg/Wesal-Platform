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

/**
 * Discriminator on the unified `/assistant` response, mirroring the backend
 * `AiAssistantResponseKind`: Answer text, a Halls list, one hall's details,
 * per-period Availability, a Clarification question, an Unsupported action, or
 * a service-level Error.
 */
export type AiAssistantResponseKind =
  | "Answer"
  | "Halls"
  | "HallDetails"
  | "Availability"
  | "Clarification"
  | "Unsupported"
  | "Error";

/** One booking period row inside an `/assistant` availability payload. */
export type AiAvailabilityPeriod = {
  periodType: string;
  periodName: string;
  startTime: string;
  endTime: string;
  status: string;
};

/** Per-period availability for a single hall and date from the unified assistant. */
export type AiHallAvailability = {
  hallId: string;
  hallName: string;
  date: string;
  periods: AiAvailabilityPeriod[];
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
  /** How-to category (e.g. payment, booking). Null for hall-related turns. */
  category: string | null;
  /** Structured per-period availability from the unified `/assistant` endpoint. */
  availability: AiHallAvailability | null;
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
