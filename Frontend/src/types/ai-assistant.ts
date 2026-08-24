import type { UiLang } from "@/lib/language";

/** Visual/logical state of the floating assistant. */
export type AiAssistantPhase =
  | "idle"
  | "loading"
  | "active"
  | "error"
  | "unavailable";

export type AiSession = {
  sessionId: string;
  language: UiLang;
  createdAt: string;
  expiresAt: string;
};

/**
 * `network` means this device has no connection, `service` means the AI backend
 * itself is down. The two need different copy and different recovery behaviour:
 * a network outage can self-heal on the browser `online` event.
 */
export type AiUnavailableReason = "service" | "network";

/**
 * `unavailable` means the AI service could not be reached at all, `error`
 * means the request itself was rejected. The panel shows different copy for each.
 */
export type AiSessionFailure = {
  kind: Extract<AiAssistantPhase, "error" | "unavailable">;
  messageKey: string;
  reason: AiUnavailableReason;
};
