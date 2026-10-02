import type { AiPinnedHall } from "@/types/ai-assistant";
import type { AiChatMessage } from "@/types/ai-chat";
import { isValidHallId } from "@/lib/wesal-routes";

/**
 * Light UI continuity for Mabrouk across page loads in ONE browser tab
 * (sessionStorage): the visible thread, the pinned hall and the backend session id.
 * This is NOT authoritative memory — the backend owns conversation state and the
 * session may already be gone, in which case the chat recovers on its own.
 *
 * Never stored: JWTs, credentials, private documents, page content. Only the chat
 * text the user already sees, public hall ids/names and an opaque session id.
 */
/** Legacy unscoped key is intentionally discarded; ownership cannot be proven. */
export const AI_CHAT_STORAGE_KEY = "wesal_ai_chat_v1";
export const AI_CHAT_GUEST_STORAGE_KEY = "wesal_ai_chat_guest";
const AI_CHAT_USER_STORAGE_PREFIX = "wesal_ai_chat_v1_";
export const AI_CHAT_SCHEMA_VERSION = 1;
/** Matches the backend sliding session TTL (30 min) with a safety margin. */
export const AI_CHAT_MAX_AGE_MS = 25 * 60 * 1000;
export const AI_CHAT_MAX_MESSAGES = 40;
const MAX_TEXT_LENGTH = 4000;
const MAX_HALLS_PER_MESSAGE = 8;

export type AiChatSnapshot = {
  v: typeof AI_CHAT_SCHEMA_VERSION;
  savedAt: number;
  lang: string;
  sessionId: string | null;
  messages: AiChatMessage[];
  pinned: AiPinnedHall | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max = MAX_TEXT_LENGTH): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const VARIANTS = new Set(["default", "help", "fallback", "error"]);

/** Rebuilds a message from untrusted stored JSON, dropping anything malformed. */
function reviveMessage(raw: unknown): AiChatMessage | null {
  if (!isRecord(raw)) return null;
  const role = raw.role === "user" || raw.role === "assistant" ? raw.role : null;
  const id = cleanString(raw.id, 100);
  const text = cleanString(raw.text);
  if (!role || !id || !text) return null;

  const halls = Array.isArray(raw.halls)
    ? raw.halls
        .filter(isRecord)
        .slice(0, MAX_HALLS_PER_MESSAGE)
        .map((hall) => ({
          hallId: cleanString(hall.hallId, 64),
          hallName: cleanString(hall.hallName, 120),
          region: typeof hall.region === "string" ? hall.region.slice(0, 80) : null,
          address: typeof hall.address === "string" ? hall.address.slice(0, 160) : null,
          capacity: typeof hall.capacity === "number" ? hall.capacity : null,
          price: typeof hall.price === "number" ? hall.price : null,
          mainImage: typeof hall.mainImage === "string" ? hall.mainImage.slice(0, 500) : null,
          isAvailable: hall.isAvailable !== false,
          unavailableReason:
            typeof hall.unavailableReason === "string" ? hall.unavailableReason.slice(0, 200) : null,
        }))
        .filter((hall) => hall.hallId)
    : [];

  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter(isRecord)
        .slice(0, 3)
        .map((action) => ({
          type: "Navigate" as const,
          pageKey: cleanString(action.pageKey, 60),
          href: cleanString(action.href, 200),
          label: cleanString(action.label, 80),
          // A restored action must never auto-navigate again on reload.
          mode: "suggest" as const,
        }))
        .filter((action) => action.pageKey && action.href && action.label)
    : [];

  return {
    id,
    role,
    text,
    createdAt: cleanString(raw.createdAt, 40) || new Date(0).toISOString(),
    variant: VARIANTS.has(String(raw.variant)) ? (raw.variant as AiChatMessage["variant"]) : "default",
    halls,
    recommendationStatus: null,
    criteria: null,
    lang: raw.lang === "ar" || raw.lang === "en" ? raw.lang : null,
    category: typeof raw.category === "string" ? raw.category.slice(0, 40) : null,
    availability: null,
    actions,
  };
}

/** Parses stored JSON defensively; returns null for anything stale, foreign or corrupt. */
export function parseChatSnapshot(
  json: string | null,
  now: number = Date.now(),
  lang?: string,
): AiChatSnapshot | null {
  if (!json || json.length > 400_000) return null;

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isRecord(data) || data.v !== AI_CHAT_SCHEMA_VERSION) return null;
  const savedAt = typeof data.savedAt === "number" ? data.savedAt : 0;
  if (!Number.isFinite(savedAt) || now - savedAt > AI_CHAT_MAX_AGE_MS || savedAt > now + 60_000) {
    return null;
  }
  const snapshotLang = cleanString(data.lang, 8);
  if (lang && snapshotLang !== lang) return null;

  const messages = (Array.isArray(data.messages) ? data.messages : [])
    .map(reviveMessage)
    .filter((message): message is AiChatMessage => message !== null)
    .slice(-AI_CHAT_MAX_MESSAGES);

  let pinned: AiPinnedHall | null = null;
  if (isRecord(data.pinned) && data.pinned.type === "hall" && isValidHallId(data.pinned.id)) {
    pinned = {
      type: "hall",
      id: String(data.pinned.id).trim(),
      name: typeof data.pinned.name === "string" ? data.pinned.name.slice(0, 120) : null,
    };
  }

  const sessionId =
    typeof data.sessionId === "string" && /^[0-9a-fA-F-]{36}$/.test(data.sessionId)
      ? data.sessionId
      : null;

  return { v: AI_CHAT_SCHEMA_VERSION, savedAt, lang: snapshotLang, sessionId, messages, pinned };
}

export function serializeChatSnapshot(
  input: Pick<AiChatSnapshot, "lang" | "sessionId" | "messages" | "pinned">,
  now: number = Date.now(),
): string {
  const snapshot: AiChatSnapshot = {
    v: AI_CHAT_SCHEMA_VERSION,
    savedAt: now,
    lang: input.lang,
    sessionId: input.sessionId,
    // Only user-visible content survives; criteria/availability are cheap to re-ask.
    messages: input.messages
      .filter((message) => message.id !== "greeting")
      .slice(-AI_CHAT_MAX_MESSAGES)
      .map((message) => ({
        ...message,
        text: message.text.slice(0, MAX_TEXT_LENGTH),
        availability: null,
        criteria: null,
        recommendationStatus: null,
      })),
    pinned: input.pinned,
  };
  return JSON.stringify(snapshot);
}

export function readChatSnapshot(lang?: string): AiChatSnapshot | null {
  return readChatSnapshotForOwner(lang, null);
}

function snapshotKey(userId: string | null): string {
  return userId ? `${AI_CHAT_USER_STORAGE_PREFIX}${encodeURIComponent(userId)}` : AI_CHAT_GUEST_STORAGE_KEY;
}

function clearLegacySnapshot(storage: StorageLike): void {
  try { storage.removeItem(AI_CHAT_STORAGE_KEY); } catch { /* ignore */ }
}

export function readChatSnapshotForOwner(lang: string | undefined, userId: string | null): AiChatSnapshot | null {
  const storage = getStorage();
  if (!storage) return null;
  clearLegacySnapshot(storage);
  try {
    return parseChatSnapshot(storage.getItem(snapshotKey(userId)), Date.now(), lang);
  } catch {
    return null;
  }
}

export function writeChatSnapshot(
  input: Pick<AiChatSnapshot, "lang" | "sessionId" | "messages" | "pinned">,
  userId: string | null = null,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    clearLegacySnapshot(storage);
    storage.setItem(snapshotKey(userId), serializeChatSnapshot(input));
  } catch {
    /* quota exceeded / private mode: continuity is best-effort */
  }
}

export function clearChatSnapshot(userId: string | null = null): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(snapshotKey(userId));
    clearLegacySnapshot(storage);
  } catch {
    /* ignore */
  }
}
