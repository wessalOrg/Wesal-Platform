import {
  addFavoriteHall,
  fetchFavoriteHallIds,
  hasHallFavoritesSession,
  removeFavoriteHall,
} from "@/services/hall-favorites";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount, subscribeAuthenticatedAccount,
  type AuthenticatedAccount } from "@/lib/authenticated-account";

const SAVED_HALLS_KEY = "wesal-saved-halls";
const EMPTY_SAVED_HALLS: string[] = [];
const HYDRATION_TTL_MS = 30_000;

const listeners = new Set<() => void>();
let snapshot: string[] = EMPTY_SAVED_HALLS;
let snapshotKey = "";
let hydratedAt = 0;
let hydrationInflight: Promise<void> | null = null;
let owner: AuthenticatedAccount | null = null;

function synchronizeOwner() {
  const account = readAuthenticatedAccount();
  if (account !== owner) {
    owner = account;
    snapshot = EMPTY_SAVED_HALLS;
    snapshotKey = "";
    hydratedAt = 0;
    hydrationInflight = null;
  }
  return account;
}

function storageKey(account: AuthenticatedAccount | null) {
  return `${SAVED_HALLS_KEY}:${account ? `user:${encodeURIComponent(account.userId)}` : "guest"}`;
}

function parseSavedHallIds(raw: string | null): string[] {
  if (!raw) return EMPTY_SAVED_HALLS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_SAVED_HALLS;
    const ids = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return ids.length > 0 ? ids : EMPTY_SAVED_HALLS;
  } catch {
    return EMPTY_SAVED_HALLS;
  }
}

function remember(ids: string[]): string[] {
  const key = ids.join("\0");
  if (key === snapshotKey) return snapshot;
  snapshotKey = key;
  snapshot = ids;
  return snapshot;
}

export function readSavedHallIds(): string[] {
  if (typeof window === "undefined") return EMPTY_SAVED_HALLS;
  const account = synchronizeOwner();
  try {
    return remember(parseSavedHallIds(window.localStorage.getItem(storageKey(account))));
  } catch {
    return remember(EMPTY_SAVED_HALLS);
  }
}

export function getServerSavedHallIds(): string[] {
  return EMPTY_SAVED_HALLS;
}

function emitSavedHalls() {
  listeners.forEach((listener) => listener());
}

export function subscribeSavedHalls(listener: () => void) {
  listeners.add(listener);
  const unsubscribeAccount = subscribeAuthenticatedAccount(() => {
    synchronizeOwner();
    listener();
  });
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey(readAuthenticatedAccount())) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    unsubscribeAccount();
    window.removeEventListener("storage", onStorage);
  };
}

function writeSavedHallIds(ids: string[]) {
  const account = synchronizeOwner();
  try { window.localStorage.setItem(storageKey(account), JSON.stringify(ids)); } catch { /* private mode */ }
  remember(ids);
  emitSavedHalls();
}

/**
 * Pulls the signed-in user's saved halls from the server so the list survives a new
 * device/browser. Server state is authoritative; demo/stub sessions and offline failures
 * keep whatever is already saved locally. Throttled so visiting several halls does not
 * re-fetch in a burst.
 */
export async function hydrateSavedHallsFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const account = synchronizeOwner();
  if (!account || !hasHallFavoritesSession()) return;
  if (hydrationInflight) return hydrationInflight;
  if (hydratedAt > 0 && Date.now() - hydratedAt < HYDRATION_TTL_MS) return;

  const pending = Promise.resolve().then(async () => {
    try {
      const ids = await fetchFavoriteHallIds();
      if (!isCurrentAuthenticatedAccount(account)) return;
      writeSavedHallIds(ids);
    } catch {
      // Offline / transient failure: keep what is already saved locally.
    } finally {
      if (isCurrentAuthenticatedAccount(account) && hydrationInflight === pending) {
        hydratedAt = Date.now();
        hydrationInflight = null;
      }
    }
  });
  hydrationInflight = pending;
  return pending;
}

function syncSavedHallToServer(hallId: string, add: boolean) {
  if (!hasHallFavoritesSession()) return;
  const call = add ? addFavoriteHall(hallId) : removeFavoriteHall(hallId);
  // Best-effort: the local list already reflects the intent, and the next hydration reconciles.
  void call.catch(() => {});
}

export function isHallSaved(hallId: string): boolean {
  return readSavedHallIds().includes(hallId);
}

export function toggleSavedHall(hallId: string): boolean {
  const current = readSavedHallIds();
  const saved = current.includes(hallId);
  writeSavedHallIds(saved ? current.filter((id) => id !== hallId) : [...current, hallId]);
  syncSavedHallToServer(hallId, !saved);
  return !saved;
}

export function removeSavedHall(hallId: string) {
  const current = readSavedHallIds();
  if (!current.includes(hallId)) return;
  writeSavedHallIds(current.filter((id) => id !== hallId));
  syncSavedHallToServer(hallId, false);
}
