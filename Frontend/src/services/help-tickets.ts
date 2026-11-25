import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type { HelpTicket, HelpTicketStatus } from "@/types/help-center";

const READ_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 30000;

/**
 * Retries only when the request never got an HTTP response (timeout / network / cold start),
 * so a slow server boot does not surface as a hard failure. HTTP errors (401/4xx/5xx) are
 * thrown on the first try because retrying a POST could duplicate a ticket.
 */
async function withTransientRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiError && error.status === undefined;
      if (!retryable || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

export type HelpSubmitErrorKind = "auth" | "network" | "server" | "unknown";

/** Why a Help Center write failed, so the UI can guide the user instead of a blind retry. */
export function classifyHelpSubmitError(error: unknown): HelpSubmitErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === undefined) return "network";
    if (error.status >= 500 || error.status === 404) return "server";
  }
  return "unknown";
}

/**
 * The durable Help Center ("مركز المساعدة") backed by `/help/tickets`. Owners act only on
 * their own tickets; the Admin queue is behind `/admin/help/tickets`. Demo/stub login has no
 * server session, so it stays on the local store instead of calling the API.
 */
export function helpTicketsUseMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/** Whether a real (non-stub) session exists, so the server is the source of truth. */
export function hasHelpTicketsSession(): boolean {
  const token = getAccessToken();
  return typeof token === "string" && token.length > 0 && !token.startsWith("stub-");
}

/** Mirrors `HelpTicketDto`; the API already lowercases `status` to match the local shape. */
type ApiHelpTicket = {
  id?: string;
  userId?: string;
  userName?: string;
  question?: string;
  createdAt?: string;
  status?: string;
  reply?: string | null;
  repliedAt?: string | null;
  userUnread?: boolean;
  adminUnread?: boolean;
};

type ApiPagedHelpTickets = {
  items?: ApiHelpTicket[] | null;
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export type AdminHelpTicketPage = {
  items: HelpTicket[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export async function fetchAdminHelpTicketPage(page = 1, signal?: AbortSignal): Promise<AdminHelpTicketPage> {
  if (helpTicketsUseMock()) {
    const { listHelpTickets } = await import("@/lib/help-center-storage");
    const tickets = listHelpTickets();
    const totalCount = tickets.length, pageSize = 100, totalPages = Math.ceil(totalCount / pageSize);
    return { items: tickets.slice((page - 1) * pageSize, page * pageSize), totalCount, pageSize,
      pageNumber: page, totalPages, hasPreviousPage: page > 1, hasNextPage: page < totalPages };
  }
  const { data } = await api.get<ApiPagedHelpTickets>("/admin/help/tickets", {
    params: { page, pageSize: 100 }, signal, timeout: READ_TIMEOUT_MS,
  });
  if (!data || !Array.isArray(data.items) ||
      !Number.isInteger(data.pageNumber) || Number(data.pageNumber) < 1 ||
      !Number.isInteger(data.pageSize) || Number(data.pageSize) < 1 ||
      !Number.isInteger(data.totalCount) || Number(data.totalCount) < 0 ||
      !Number.isInteger(data.totalPages) || Number(data.totalPages) < 0 ||
      typeof data.hasNextPage !== "boolean" || typeof data.hasPreviousPage !== "boolean") {
    throw new Error("Invalid help ticket pagination response.");
  }
  return { items: data.items.map(mapHelpTicket).filter((item): item is HelpTicket => item !== null),
    totalCount: data.totalCount!, pageNumber: data.pageNumber!, pageSize: data.pageSize!,
    totalPages: data.totalPages!, hasNextPage: data.hasNextPage, hasPreviousPage: data.hasPreviousPage };
}

/** Ticket totals are not conversation totals. A partial page cannot establish a global unread count. */
export function countUnreadHelpConversations(page: AdminHelpTicketPage): number | null {
  if (page.pageNumber !== 1 || page.hasNextPage || page.items.length !== page.totalCount) return null;
  return new Set(page.items.filter(ticket => ticket.adminUnread).map(ticket => ticket.userId)).size;
}

type ApiCreatedHelpTicket = ApiHelpTicket;

function normalizeStatus(value: unknown): HelpTicketStatus {
  return typeof value === "string" && value.toLowerCase() === "replied" ? "replied" : "open";
}

function mapHelpTicket(item: ApiHelpTicket): HelpTicket | null {
  const id = String(item.id ?? "").trim();
  const userId = String(item.userId ?? "").trim();
  if (!id || !userId) return null;

  return {
    id,
    userId,
    userName: String(item.userName ?? "").trim() || "مستخدم",
    question: String(item.question ?? "").trim(),
    createdAt: item.createdAt?.trim() || new Date().toISOString(),
    status: normalizeStatus(item.status),
    reply: typeof item.reply === "string" && item.reply.trim() ? item.reply.trim() : null,
    repliedAt: item.repliedAt?.trim() || null,
    userUnread: Boolean(item.userUnread),
    adminUnread: Boolean(item.adminUnread),
  };
}

/** The signed-in user's tickets, newest first. */
export async function fetchMyHelpTickets(): Promise<HelpTicket[]> {
  const { data } = await withTransientRetry(() =>
    api.get<ApiHelpTicket[]>("/help/tickets", { timeout: READ_TIMEOUT_MS }),
  );
  return (Array.isArray(data) ? data : [])
    .map(mapHelpTicket)
    .filter((ticket): ticket is HelpTicket => Boolean(ticket));
}

/** Every ticket, for the Admin queue. */
export async function fetchAllHelpTickets(pageSize = 100): Promise<HelpTicket[]> {
  const { data } = await withTransientRetry(() =>
    api.get<ApiPagedHelpTickets>("/admin/help/tickets", {
      params: { page: 1, pageSize },
      timeout: READ_TIMEOUT_MS,
    }),
  );
  return (Array.isArray(data?.items) ? data.items : [])
    .map(mapHelpTicket)
    .filter((ticket): ticket is HelpTicket => Boolean(ticket));
}

/** Conversations (distinct askers) with at least one question no Admin has opened yet. */
export async function fetchUnreadHelpConversationCount(): Promise<number | null> {
  return countUnreadHelpConversations(await fetchAdminHelpTicketPage());
}

export async function submitHelpTicket(input: {
  userName: string;
  question: string;
}): Promise<HelpTicket> {
  const { data } = await withTransientRetry(() =>
    api.post<ApiCreatedHelpTicket>(
      "/help/tickets",
      { userName: input.userName, question: input.question },
      { timeout: WRITE_TIMEOUT_MS },
    ),
  );
  const ticket = mapHelpTicket(data ?? {});
  if (!ticket) throw new Error("Invalid help ticket response.");
  return ticket;
}

/** Clears the owner's "unread reply" flag. */
export async function markHelpTicketReadOnServer(id: string): Promise<void> {
  await withTransientRetry(() => api.post(`/help/tickets/${id}/read`, undefined, { timeout: READ_TIMEOUT_MS }));
}

/** Marks the asker's whole conversation read for every Admin (shared read state). */
export async function markHelpConversationReadOnServer(userId: string, signal?: AbortSignal): Promise<void> {
  if (helpTicketsUseMock()) {
    const { markHelpConversationRead } = await import("@/lib/help-center-storage");
    if (!signal?.aborted) markHelpConversationRead(userId);
    return;
  }
  const send = () =>
    api.post(
      `/admin/help/tickets/conversations/${encodeURIComponent(userId)}/read`,
      undefined,
      { timeout: READ_TIMEOUT_MS, signal },
    );
  if (signal) await send(); else await withTransientRetry(send);
}

/** Admin answer; also flips the ticket to "replied" server-side. */
export async function replyHelpTicket(id: string, reply: string, signal?: AbortSignal): Promise<HelpTicket> {
  if (helpTicketsUseMock()) {
    const { replyToHelpTicket } = await import("@/lib/help-center-storage");
    if (signal?.aborted) throw new Error("Help ticket request cancelled.");
    const ticket = replyToHelpTicket(id, reply);
    if (!ticket) throw new Error("Invalid help ticket response.");
    return ticket;
  }
  const send = () =>
    api.post<ApiHelpTicket>(
      `/admin/help/tickets/${id}/reply`,
      { reply },
      { timeout: WRITE_TIMEOUT_MS, signal },
    );
  const { data } = await (signal ? send() : withTransientRetry(send));
  const ticket = mapHelpTicket(data ?? {});
  if (!ticket) throw new Error("Invalid help ticket response.");
  return ticket;
}
