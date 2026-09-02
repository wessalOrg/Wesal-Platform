import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { isBrowserOffline } from "@/services/ai-assistant";
import type {
  AiChatTextLang,
  AiChatVariant,
  AiExtractedCriteria,
  AiHallAvailability,
  AiRecommendedHall,
  RecommendationStatus,
} from "@/types/ai-chat";
import { parseChatResponseLanguage } from "@/lib/ai-chat-text-direction";

const CHAT_TIMEOUT_MS = 25_000;
const QUESTION_MAX_LENGTH = 500;

const ASSISTANT_KINDS: readonly string[] = [
  "Answer",
  "Halls",
  "HallDetails",
  "Availability",
  "Clarification",
  "Unsupported",
  "Error",
];

type AssistantRequest = { message?: string | null };
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
type AssistantHallDetailsDto = {
  hallId?: string;
  hallName?: string | null;
  region?: string | null;
  address?: string | null;
  description?: string | null;
  capacity?: number | null;
  price?: number | null;
  contactPhone?: string | null;
  status?: string | null;
  photos?: { id?: string; url?: string }[] | null;
};
type AssistantAvailabilityPeriodDto = {
  periodType?: string | null;
  periodName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
};
type AssistantAvailabilityDayDto = {
  hallId?: string;
  hallName?: string | null;
  date?: string | null;
  periods?: AssistantAvailabilityPeriodDto[] | null;
};
type AssistantIntentDto = {
  intent?: string | null;
  region?: string | null;
  area?: string | null;
  date?: string | { year?: number; month?: number; day?: number } | null;
  bookingPeriod?: string | null;
  capacity?: number | null;
  hallName?: string | null;
};
type AssistantResponseDto = {
  kind?: string | null;
  message?: string | null;
  responseLanguage?: string | null;
  timestamp?: string;
  halls?: HallRecommendationDto[] | null;
  hallDetails?: AssistantHallDetailsDto | null;
  availability?: AssistantAvailabilityDayDto | null;
  intent?: AssistantIntentDto | null;
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
  availability: AiHallAvailability | null;
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
 * Only used to pick the loading skeleton while a turn is in flight. The backend
 * owns intent classification now; the choice no longer routes the request.
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

function normalizeAssistantKind(value: unknown): string | null {
  if (typeof value === "string" && ASSISTANT_KINDS.includes(value)) return value;
  return null;
}

function readTrimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function mapHallDetails(details: AssistantHallDetailsDto | null | undefined): AiRecommendedHall | null {
  if (!details) return null;
  const hallId = String(details.hallId ?? "");
  if (!hallId) return null;
  return {
    hallId,
    hallName: readTrimmed(details.hallName) ?? "",
    region: readTrimmed(details.region),
    address: readTrimmed(details.address),
    capacity: typeof details.capacity === "number" ? details.capacity : null,
    price: typeof details.price === "number" ? details.price : null,
    mainImage: readTrimmed(details.photos?.[0]?.url),
    isAvailable: details.status === "Approved",
    unavailableReason: null,
  };
}

function mapAvailability(data: AssistantAvailabilityDayDto | null | undefined): AiHallAvailability | null {
  if (!data) return null;
  const hallId = String(data.hallId ?? "");
  if (!hallId) return null;
  return {
    hallId,
    hallName: readTrimmed(data.hallName) ?? "",
    date: readTrimmed(data.date) ?? "",
    periods: Array.isArray(data.periods)
      ? data.periods.map((period) => ({
          periodType: readTrimmed(period.periodType) ?? "",
          periodName: readTrimmed(period.periodName) ?? "",
          startTime: readTrimmed(period.startTime) ?? "",
          endTime: readTrimmed(period.endTime) ?? "",
          status: readTrimmed(period.status) ?? "Available",
        }))
      : [],
  };
}

function parseAssistantCriteria(intent: AssistantIntentDto | null | undefined): AiExtractedCriteria | null {
  if (!intent) return null;
  const criteria: AiExtractedCriteria = {
    region: readTrimmed(intent.region),
    area: readTrimmed(intent.area),
    date: readDate(intent.date),
    bookingPeriod: readTrimmed(intent.bookingPeriod),
    capacity: typeof intent.capacity === "number" ? intent.capacity : null,
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
    availability: null,
  };
}

function isAssistantPayload(data: unknown): data is AssistantResponseDto {
  if (!data || typeof data !== "object") return false;
  const row = data as AssistantResponseDto;
  return normalizeAssistantKind(row.kind) !== null || typeof row.message === "string";
}

function mapAssistant(data: AssistantResponseDto): AiChatTurn {
  const kind = normalizeAssistantKind(data.kind);
  const text = readTrimmed(data.message) ?? "";
  const lang = parseChatResponseLanguage(data.responseLanguage);
  const timestamp = stamp(data.timestamp);
  const criteria = parseAssistantCriteria(data.intent);
  const halls = mapHalls(data.halls);

  switch (kind) {
    case "Halls":
      return {
        text: text || (halls.length ? "assistant.chat.foundHalls" : "errors.assistant.chat.noResults"),
        variant: halls.length ? "default" : "fallback",
        halls,
        recommendationStatus: halls.length ? "Success" : "NoResults",
        criteria,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: null,
      };
    case "HallDetails": {
      const detail = mapHallDetails(data.hallDetails);
      return {
        text: text || "errors.assistant.chat.emptyReply",
        variant: detail ? "default" : "fallback",
        halls: detail ? [detail] : [],
        recommendationStatus: detail ? "Success" : "NoResults",
        criteria: null,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: null,
      };
    }
    case "Availability":
      return {
        text: text || "errors.assistant.chat.emptyReply",
        variant: "default",
        halls: [],
        recommendationStatus: null,
        criteria,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: mapAvailability(data.availability),
      };
    case "Clarification":
      return {
        text: text || "errors.assistant.chat.incomplete",
        variant: "help",
        halls: [],
        recommendationStatus: null,
        criteria,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: null,
      };
    case "Unsupported":
      return {
        text: text || "errors.assistant.chat.send",
        variant: "fallback",
        halls: [],
        recommendationStatus: null,
        criteria: null,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: null,
      };
    case "Error":
      return {
        text: text || "errors.assistant.chat.unavailable",
        variant: "fallback",
        halls: [],
        recommendationStatus: null,
        criteria: null,
        lang,
        category: null,
        timestamp,
        sessionExpired: false,
        availability: null,
      };
    default:
      // Unknown discriminator (new backend kind, proxy HTML, ...): show the text
      // the backend sent instead of crashing the turn.
      return emptyTurn(
        text || "errors.assistant.chat.emptyReply",
        "default",
      );
  }
}

async function postChat<T>(
  url: string,
  body: AssistantRequest,
  signal?: AbortSignal,
) {
  return api.post<T>(url, body, {
    timeout: CHAT_TIMEOUT_MS,
    signal,
    // 503 is tolerated so a proxy error is still surfaced as an assistant turn.
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

  try {
    const { status, data } = await postChat<AssistantResponseDto | ProblemDetails>(
      `/ai/sessions/${sessionId}/assistant`,
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
    if (status === 503) {
      throw new ApiError(
        problemMessage(data) || "errors.assistant.chat.send",
        503,
      );
    }
    if (!isAssistantPayload(data)) {
      throw new ApiError("errors.assistant.chat.send", 502);
    }

    return mapAssistant(data);
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