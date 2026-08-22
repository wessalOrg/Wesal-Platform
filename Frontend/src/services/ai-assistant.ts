import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { isUiLang, type UiLang } from "@/lib/language";
import type { AiSession, AiSessionFailure } from "@/types/ai-assistant";

/** Only used when the payload omits `expiresAt`; mirrors the backend sliding TTL. */
const FALLBACK_SESSION_TTL_MS = 30 * 60 * 1000;

type AiSessionResponse = {
  sessionId?: string;
  language?: string | null;
  createdAt?: string;
  expiresAt?: string;
};

function mapResponse(data: AiSessionResponse, requested: UiLang): AiSession {
  const createdAt = data.createdAt ?? new Date().toISOString();
  const createdMs = Date.parse(createdAt);
  const baseMs = Number.isNaN(createdMs) ? Date.now() : createdMs;

  return {
    sessionId: String(data.sessionId ?? ""),
    language: isUiLang(data.language) ? data.language : requested,
    createdAt,
    expiresAt:
      data.expiresAt ?? new Date(baseMs + FALLBACK_SESSION_TTL_MS).toISOString(),
  };
}

/** `navigator.onLine` is only trustworthy when false, which is all we rely on. */
export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function initializeAiSession(
  language: UiLang,
  signal?: AbortSignal,
): Promise<AiSession> {
  const { data } = await api.post<AiSessionResponse>(
    "/ai/sessions",
    { language },
    { timeout: 8000, signal },
  );

  const session = mapResponse(data, language);
  if (!session.sessionId) {
    throw new ApiError("AI session id missing from response", 500);
  }
  return session;
}

/** Maps a failed initialization onto the phase, reason and message the panel shows. */
export function describeAiAssistantError(err: unknown): AiSessionFailure {
  if (!(err instanceof ApiError)) {
    return {
      kind: "unavailable",
      messageKey: "errors.assistant.unavailable",
      reason: "service",
    };
  }
  if (err.status === 400) {
    return {
      kind: "error",
      messageKey: "errors.assistant.language",
      reason: "service",
    };
  }
  // No status means the request never reached the API (offline, timeout, CORS).
  if (err.status == null) {
    return isBrowserOffline()
      ? {
          kind: "unavailable",
          messageKey: "errors.assistant.network",
          reason: "network",
        }
      : {
          kind: "unavailable",
          messageKey: "errors.assistant.unavailable",
          reason: "service",
        };
  }
  if (err.status >= 500) {
    return {
      kind: "unavailable",
      messageKey: "errors.assistant.unavailable",
      reason: "service",
    };
  }
  return {
    kind: "error",
    messageKey: "errors.assistant.init",
    reason: "service",
  };
}
