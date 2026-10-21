import {
  HELP_CENTER_CHANGE_EVENT,
  HELP_CENTER_STORAGE_KEY,
  type HelpCenterStore,
  type HelpTicket,
} from "@/types/help-center";
import {
  fetchAllHelpTickets,
  fetchMyHelpTickets,
  hasHelpTicketsSession,
} from "@/services/help-tickets";

const HYDRATION_TTL_MS = 30_000;
let hydratedScope = "";
let hydratedAt = 0;
let hydrationInflight: Promise<void> | null = null;

function emptyStore(): HelpCenterStore {
  return { version: 1, tickets: [] };
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HELP_CENTER_CHANGE_EVENT));
}

export function readHelpCenterStore(): HelpCenterStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(HELP_CENTER_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<HelpCenterStore>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tickets)) {
      return emptyStore();
    }
    return {
      version: 1,
      tickets: parsed.tickets.filter(isHelpTicket).map((ticket) => ({
        ...ticket,
        adminUnread: ticket.adminUnread === true,
      })),
    };
  } catch {
    return emptyStore();
  }
}

function isHelpTicket(value: unknown): value is HelpTicket {
  if (!value || typeof value !== "object") return false;
  const ticket = value as Partial<HelpTicket>;
  return (
    typeof ticket.id === "string" &&
    typeof ticket.userId === "string" &&
    typeof ticket.userName === "string" &&
    typeof ticket.question === "string" &&
    typeof ticket.createdAt === "string" &&
    (ticket.status === "open" || ticket.status === "replied") &&
    (ticket.reply === null || typeof ticket.reply === "string") &&
    (ticket.repliedAt === null || typeof ticket.repliedAt === "string") &&
    typeof ticket.userUnread === "boolean"
  );
}

function writeHelpCenterStore(store: HelpCenterStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HELP_CENTER_STORAGE_KEY, JSON.stringify(store));
    notify();
  } catch {
    /* private mode / quota */
  }
}

/** Replaces the cached tickets with a server snapshot (server is authoritative in live mode). */
export function replaceHelpTickets(tickets: HelpTicket[]) {
  writeHelpCenterStore({ version: 1, tickets });
}

/** Inserts or updates one ticket in the cache, e.g. after filing or answering it. */
export function upsertHelpTicket(ticket: HelpTicket) {
  const store = readHelpCenterStore();
  const index = store.tickets.findIndex((item) => item.id === ticket.id);
  const tickets = [...store.tickets];
  if (index >= 0) tickets[index] = ticket;
  else tickets.unshift(ticket);
  writeHelpCenterStore({ version: 1, tickets });
}

/**
 * Pulls tickets from the server so the Help Center survives a new device/browser. `mine`
 * loads the signed-in user's tickets; `all` loads the Admin queue. Demo/stub sessions and
 * offline failures keep the local cache. Throttled to avoid a fetch burst.
 */
export async function hydrateHelpTicketsFromServer(scope: "mine" | "all" = "mine"): Promise<void> {
  if (typeof window === "undefined") return;
  if (!hasHelpTicketsSession()) return;
  if (hydrationInflight) return hydrationInflight;
  if (hydratedScope === scope && Date.now() - hydratedAt < HYDRATION_TTL_MS) return;

  hydrationInflight = (async () => {
    try {
      const tickets = scope === "all" ? await fetchAllHelpTickets() : await fetchMyHelpTickets();
      replaceHelpTickets(tickets);
    } catch {
      // Offline / transient failure: keep the cached tickets.
    } finally {
      hydratedScope = scope;
      hydratedAt = Date.now();
      hydrationInflight = null;
    }
  })();

  return hydrationInflight;
}

export function listHelpTickets(): HelpTicket[] {
  return [...readHelpCenterStore().tickets].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

const EMPTY_TICKETS: HelpTicket[] = [];
let snapshotRaw: string | null | undefined;
let snapshotTickets: HelpTicket[] = EMPTY_TICKETS;

/**
 * Referentially stable ticket list for `useSyncExternalStore`: the array is only
 * rebuilt when the persisted payload actually changes, so React can bail out.
 */
export function getHelpTicketsSnapshot(): HelpTicket[] {
  if (typeof window === "undefined") return EMPTY_TICKETS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HELP_CENTER_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotTickets = listHelpTickets();
  }
  return snapshotTickets;
}

export function getHelpTicketsServerSnapshot(): HelpTicket[] {
  return EMPTY_TICKETS;
}

export function getHelpTicket(id: string): HelpTicket | null {
  return readHelpCenterStore().tickets.find((ticket) => ticket.id === id) ?? null;
}

export function createHelpTicket(input: {
  userId: string;
  userName: string;
  question: string;
}): HelpTicket {
  const ticket: HelpTicket = {
    id: `hc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    userName: input.userName.trim() || "مستخدم",
    question: input.question.trim(),
    createdAt: new Date().toISOString(),
    status: "open",
    reply: null,
    repliedAt: null,
    userUnread: false,
    adminUnread: true,
  };
  const store = readHelpCenterStore();
  writeHelpCenterStore({ version: 1, tickets: [ticket, ...store.tickets] });
  return ticket;
}

export function replyToHelpTicket(id: string, reply: string): HelpTicket | null {
  const store = readHelpCenterStore();
  const index = store.tickets.findIndex((ticket) => ticket.id === id);
  if (index < 0) return null;
  const current = store.tickets[index];
  const updated: HelpTicket = {
    ...current,
    status: "replied",
    reply: reply.trim(),
    repliedAt: new Date().toISOString(),
    userUnread: true,
    adminUnread: false,
  };
  const tickets = [...store.tickets];
  tickets[index] = updated;
  writeHelpCenterStore({ version: 1, tickets });
  return updated;
}

export function markHelpTicketRead(id: string): void {
  const store = readHelpCenterStore();
  const index = store.tickets.findIndex((ticket) => ticket.id === id);
  if (index < 0) return;
  const current = store.tickets[index];
  if (!current.userUnread) return;
  const tickets = [...store.tickets];
  tickets[index] = { ...current, userUnread: false };
  writeHelpCenterStore({ version: 1, tickets });
}

/** Marks every question in the asker's conversation read for the Admin team. */
export function markHelpConversationRead(userId: string): void {
  const store = readHelpCenterStore();
  let changed = false;
  const tickets = store.tickets.map((ticket) => {
    if (ticket.userId !== userId || !ticket.adminUnread) return ticket;
    changed = true;
    return { ...ticket, adminUnread: false };
  });
  if (changed) writeHelpCenterStore({ version: 1, tickets });
}

export function listRepliedHelpTicketsForUser(userId: string): HelpTicket[] {
  return listHelpTickets().filter(
    (ticket) => ticket.userId === userId && ticket.status === "replied" && ticket.reply,
  );
}

export function countUnreadHelpTicketsForUser(userId: string): number {
  return listRepliedHelpTicketsForUser(userId).filter((ticket) => ticket.userUnread)
    .length;
}

export function subscribeHelpCenter(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === HELP_CENTER_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(HELP_CENTER_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HELP_CENTER_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
