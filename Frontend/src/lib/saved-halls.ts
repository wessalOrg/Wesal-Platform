const SAVED_HALLS_KEY = "wesal-saved-halls";
const EMPTY_SAVED_HALLS: string[] = [];

const listeners = new Set<() => void>();
let snapshot: string[] = EMPTY_SAVED_HALLS;
let snapshotKey = "";

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
  return remember(parseSavedHallIds(window.localStorage.getItem(SAVED_HALLS_KEY)));
}

export function getServerSavedHallIds(): string[] {
  return EMPTY_SAVED_HALLS;
}

function emitSavedHalls() {
  listeners.forEach((listener) => listener());
}

export function subscribeSavedHalls(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_HALLS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeSavedHallIds(ids: string[]) {
  window.localStorage.setItem(SAVED_HALLS_KEY, JSON.stringify(ids));
  remember(ids);
  emitSavedHalls();
}

export function isHallSaved(hallId: string): boolean {
  return readSavedHallIds().includes(hallId);
}

export function toggleSavedHall(hallId: string): boolean {
  const current = readSavedHallIds();
  const saved = current.includes(hallId);
  writeSavedHallIds(saved ? current.filter((id) => id !== hallId) : [...current, hallId]);
  return !saved;
}

export function removeSavedHall(hallId: string) {
  const current = readSavedHallIds();
  if (!current.includes(hallId)) return;
  writeSavedHallIds(current.filter((id) => id !== hallId));
}
