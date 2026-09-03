const STORAGE_PREFIX = "wesal-message-drafts:";

export function draftsStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}${ownerKey}`;
}

export function readMessageDrafts(storageKey: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: Record<string, string> = {};
    for (const [conversationId, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) next[conversationId] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function writeMessageDrafts(storageKey: string, drafts: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(drafts));
  } catch {
    /* private mode / quota */
  }
}
