import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { isBrowserOffline } from "@/services/ai-assistant";
import type {
  AiChatTextLang,
  AiChatVariant,
  AiExtractedCriteria,
  AiRecommendedHall,
  RecommendationStatus,
} from "@/types/ai-chat";
import { parseChatResponseLanguage } from "@/lib/ai-chat-text-direction";

const CHAT_TIMEOUT_MS = 25_000;
const QUESTION_MAX_LENGTH = 500;

const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  "Success",
  "IncompleteCriteria",
  "NoResults",
  "AiUnavailable",
];

type HowToRequest = { question?: string | null };
type HowToResponse = {
  answer?: string | null;
  category?: string | null;
  responseLanguage?: string | null;
  timestamp?: string;
};

type RecommendationRequest = { message?: string | null };
type HallRecommendationDto = {
  hallId?: string;
  hallName?: string | null;
  region?: string | null;
  address?: string | null;
  capacity?: number | null;
  price?: number | null;
  mainImage?: string | null;
  isAvailable?: boolean;
  unavailableReason?: string | null;
};
type ExtractedCriteriaDto = {
  region?: string | null;
  area?: string | null;
  date?: string | { year?: number; month?: number; day?: number } | null;
  bookingPeriod?: string | number | null;
  capacity?: number | null;
  eventDate?: string | null;
  period?: string | number | null;
};
type RecommendationResponse = {
  status?: RecommendationStatus | string | number;
  extractedCriteria?: ExtractedCriteriaDto | null;
  recommendations?: HallRecommendationDto[] | null;
  message?: string | null;
  responseLanguage?: string | null;
  timestamp?: string;
};

type ProblemDetails = {
  title?: string | null;
  detail?: string | null;
  message?: string | null;
  status?: number;
};

export type AiChatTurn = {
  text: string;
  variant: AiChatVariant;
  halls: AiRecommendedHall[];
  recommendationStatus: RecommendationStatus | null;
  criteria: AiExtractedCriteria | null;
  lang: AiChatTextLang | null;
  category: string | null;
  timestamp: string;
  sessionExpired: boolean;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createChatMessageId(): string {
  return newId();
}

export function validateChatQuestion(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "errors.assistant.chat.empty";
  if (text.length > QUESTION_MAX_LENGTH) return "errors.assistant.chat.tooLong";
  return null;
}

/**
 * Usage / payment questions stay on `/how-to`. Hall-search phrasing goes to
 * `/recommend`. Payment and "how do I…" must not be classified as a hall search
 * just because the sentence mentions a hall.
 */
export function isUsageQuestion(text: string): boolean {
  return (
    /(اشتراك|تجديد|أدفع|ادفع|كيف\s+أدفع|كيف\s+ادفع|رسوم\s+الاشتراك|subscription|renew|how\s+do\s+i\s+pay|how\s+can\s+i\s+pay|\bpayment\b)/i.test(
      text,
    ) ||
    /(كيف(?:\s|$)|how\s+do\s+i\b|how\s+to\b|how\s+can\s+i\b|how\s+does\b)/i.test(text)
  );
}

export function isHallSearchQuestion(text: string): boolean {
  if (isUsageQuestion(text)) return false;
  return /(قاعة|قاعات|halls?|منطقة|غزة|شمال|وسط|جنوب|تاريخ|موعد|سعة|ضيوف|capacity|gaza|date|period|فترة|region|area)/i.test(
    text,
  );
}

export function normalizeRecommendationStatus(
  value: unknown,
): RecommendationStatus | null {
  if (typeof value === "string" && RECOMMENDATION_STATUSES.includes(value as RecommendationStatus)) {
    return value as RecommendationStatus;
  }
  if (typeof value === "number" && RECOMMENDATION_STATUSES[value]) {
    return RECOMMENDATION_STATUSES[value];
  }
  return null;
}

function readTrimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readCapacity(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPeriod(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return readTrimmed(value);
}

function readDate(value: unknown): string | null {
  if (typeof value === "string") return readTrimmed(value);
  if (!value || typeof value !== "object") return null;
  const row = value as { year?: number; month?: number; day?: number };
  if (
    typeof row.year === "number" &&
    typeof row.month === "number" &&
    typeof row.day === "number"
  ) {
    const month = String(row.month).padStart(2, "0");
    const day = String(row.day).padStart(2, "0");
    return `${row.year}-${month}-${day}`;
  }
  return null;
}

export function parseExtractedCriteria(raw: unknown): AiExtractedCriteria | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as ExtractedCriteriaDto;
  const criteria: AiExtractedCriteria = {
    region: readTrimmed(row.region),
    area: readTrimmed(row.area),
    date: readDate(row.date) || readTrimmed(row.eventDate),
    bookingPeriod: readPeriod(row.bookingPeriod ?? row.period),
    capacity: readCapacity(row.capacity),
  };
  if (
    !criteria.region &&
    !criteria.area &&
    !criteria.date &&
    !criteria.bookingPeriod &&
    criteria.capacity == null
  ) {
    return null;
  }
  return criteria;
}

/** True when a chat payload is a recommend response, not a how-to answer. */
export function isRecommendationPayload(data: unknown): data is RecommendationResponse {
  if (!data || typeof data !== "object") return false;
  const row = data as RecommendationResponse;
  if (Array.isArray(row.recommendations)) return true;
  if (row.extractedCriteria && typeof row.extractedCriteria === "object") return true;
  return normalizeRecommendationStatus(row.status) !== null;
}

function mapHalls(list: HallRecommendationDto[] | null | undefined): AiRecommendedHall[] {
  if (!list?.length) return [];
  return list
    .map((hall) => ({
      hallId: String(hall.hallId ?? ""),
      hallName: (hall.hallName ?? "").trim(),
      region: hall.region?.trim() || null,
      address: hall.address?.trim() || null,
      capacity: typeof hall.capacity === "number" ? hall.capacity : null,
      price: typeof hall.price === "number" ? hall.price : null,
      mainImage: hall.mainImage?.trim() || null,
      isAvailable: hall.isAvailable !== false,
      unavailableReason: hall.unavailableReason?.trim() || null,
    }))
    .filter((hall) => hall.hallId);
}

function problemMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const body = data as ProblemDetails;
  const text = body.detail || body.title || body.message;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

function stamp(iso?: string): string {
  if (iso && !Number.isNaN(Date.parse(iso))) return iso;
  return new Date().toISOString();
}

function emptyTurn(
  text: string,
  variant: AiChatVariant,
  extras?: Partial<Pick<AiChatTurn, "sessionExpired">>,
): AiChatTurn {
  return {
    text,
    variant,
    halls: [],
    recommendationStatus: null,
    criteria: null,
    lang: null,
    category: null,
    timestamp: new Date().toISOString(),
    sessionExpired: extras?.sessionExpired ?? false,
  };
}

function mapRecommendation(data: RecommendationResponse): AiChatTurn {
  const status = normalizeRecommendationStatus(data.status);
  const halls = mapHalls(data.recommendations);
  const criteria = parseExtractedCriteria(data.extractedCriteria);
  const lang = parseChatResponseLanguage(data.responseLanguage);
  const text = (data.message ?? "").trim();
  const resolvedStatus =
    status ?? (halls.length ? "Success" : "NoResults");

  if (resolvedStatus === "AiUnavailable") {
    return {
      text: text || "errors.assistant.chat.unavailable",
      variant: "fallback",
      halls,
      recommendationStatus: resolvedStatus,
      criteria,
      lang,
      category: null,
      timestamp: stamp(data.timestamp),
      sessionExpired: false,
    };
  }
  if (resolvedStatus === "NoResults" || (resolvedStatus === "Success" && halls.length === 0)) {
    return {
      text: text || "errors.assistant.chat.noResults",
      variant: "fallback",
      halls,
      recommendationStatus: "NoResults",
      criteria,
      lang,
      category: null,
      timestamp: stamp(data.timestamp),
      sessionExpired: false,
    };
  }
  if (resolvedStatus === "IncompleteCriteria") {
    return {
      text: text || "errors.assistant.chat.incomplete",
      variant: "help",
      halls,
      recommendationStatus: resolvedStatus,
      criteria,
      lang,
      category: null,
      timestamp: stamp(data.timestamp),
      sessionExpired: false,
    };
  }
  return {
    text: text || (halls.length ? "assistant.chat.foundHalls" : "errors.assistant.chat.noResults"),
    variant: halls.length ? "default" : "fallback",
    halls,
    recommendationStatus: halls.length ? "Success" : "NoResults",
    criteria,
    lang,
    category: null,
    timestamp: stamp(data.timestamp),
    sessionExpired: false,
  };
}

async function postChat<T>(
  url: string,
  body: HowToRequest | RecommendationRequest,
  signal?: AbortSignal,
) {
  return api.post<T>(url, body, {
    timeout: CHAT_TIMEOUT_MS,
    signal,
    // 503 on `/recommend` still carries a fallback RecommendationResponse.
    validateStatus: (status) =>
      status === 200 || status === 400 || status === 404 || status === 503,
  });
}

export async function sendAiChatTurn(
  sessionId: string,
  raw: string,
  signal?: AbortSignal,
): Promise<AiChatTurn> {
  const invalid = validateChatQuestion(raw);
  if (invalid) {
    throw new ApiError(invalid, 400);
  }

  if (isBrowserOffline()) {
    throw new ApiError("errors.assistant.network", 0);
  }

  const text = raw.trim();
  const useRecommend = isHallSearchQuestion(text);

  try {
    if (!useRecommend) {
      const { status, data } = await postChat<HowToResponse | ProblemDetails>(
        `/ai/sessions/${sessionId}/how-to`,
        { question: text },
        signal,
      );
      if (status === 404) {
        return emptyTurn("errors.assistant.chat.expired", "error", { sessionExpired: true });
      }
      if (status === 400) {
        throw new ApiError(
          problemMessage(data) || "errors.assistant.chat.validation",
          400,
        );
      }
      if (status === 503) {
        throw new ApiError(
          problemMessage(data) || "errors.assistant.chat.send",
          503,
        );
      }
      const howTo = data as HowToResponse;
      const answer = howTo.answer?.trim();
      return {
        text: answer || "errors.assistant.chat.emptyReply",
        variant: "help",
        halls: [],
        recommendationStatus: null,
        criteria: null,
        lang: parseChatResponseLanguage(howTo.responseLanguage),
        category: (howTo.category ?? "").trim() || null,
        timestamp: stamp(howTo.timestamp),
        sessionExpired: false,
      };
    }

    const { status, data } = await postChat<RecommendationResponse | ProblemDetails>(
      `/ai/sessions/${sessionId}/recommend`,
      { message: text },
      signal,
    );

    if (status === 404) {
      return emptyTurn("errors.assistant.chat.expired", "error", { sessionExpired: true });
    }
    if (status === 400) {
      throw new ApiError(
        problemMessage(data) || "errors.assistant.chat.validation",
        400,
      );
    }

    if (!isRecommendationPayload(data)) {
      throw new ApiError("errors.assistant.chat.send", status === 503 ? 503 : 502);
    }

    return mapRecommendation(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isBrowserOffline()) throw new ApiError("errors.assistant.network", 0);
    throw new ApiError("errors.assistant.chat.send", 503);
  }
}

export function describeChatError(err: unknown): {
  text: string;
  sessionExpired: boolean;
  retryable: boolean;
} {
  if (err instanceof ApiError) {
    const keyOrText = err.message || "errors.assistant.chat.send";
    const validation =
      err.status === 400 ||
      keyOrText === "errors.assistant.chat.empty" ||
      keyOrText === "errors.assistant.chat.tooLong" ||
      keyOrText === "errors.assistant.chat.validation";
    const expired =
      err.status === 404 || keyOrText === "errors.assistant.chat.expired";
    return {
      text: keyOrText,
      sessionExpired: expired,
      retryable: !validation && !expired,
    };
  }
  return { text: "errors.assistant.chat.send", sessionExpired: false, retryable: true };
}
