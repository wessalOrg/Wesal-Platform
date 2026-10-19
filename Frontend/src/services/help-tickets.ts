import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import type { HelpTicket, HelpTicketStatus } from "@/types/help-center";

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
};

type ApiPagedHelpTickets = {
  items?: ApiHelpTicket[] | null;
};

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
  };
}

/** The signed-in user's tickets, newest first. */
export async function fetchMyHelpTickets(): Promise<HelpTicket[]> {
  const { data } = await api.get<ApiHelpTicket[]>("/help/tickets", { timeout: 8000 });
  return (Array.isArray(data) ? data : [])
    .map(mapHelpTicket)
    .filter((ticket): ticket is HelpTicket => Boolean(ticket));
}

/** Every ticket, for the Admin queue. */
export async function fetchAllHelpTickets(pageSize = 100): Promise<HelpTicket[]> {
  const { data } = await api.get<ApiPagedHelpTickets>("/admin/help/tickets", {
    params: { page: 1, pageSize },
    timeout: 8000,
  });
  return (Array.isArray(data?.items) ? data.items : [])
    .map(mapHelpTicket)
    .filter((ticket): ticket is HelpTicket => Boolean(ticket));
}

export async function submitHelpTicket(input: {
  userName: string;
  question: string;
}): Promise<HelpTicket> {
  const { data } = await api.post<ApiCreatedHelpTicket>(
    "/help/tickets",
    { userName: input.userName, question: input.question },
    { timeout: 10000 },
  );
  const ticket = mapHelpTicket(data ?? {});
  if (!ticket) throw new Error("Invalid help ticket response.");
  return ticket;
}

/** Clears the owner's "unread reply" flag. */
export async function markHelpTicketReadOnServer(id: string): Promise<void> {
  await api.post(`/help/tickets/${id}/read`, undefined, { timeout: 8000 });
}

/** Admin answer; also flips the ticket to "replied" server-side. */
export async function replyHelpTicket(id: string, reply: string): Promise<HelpTicket> {
  const { data } = await api.post<ApiHelpTicket>(
    `/admin/help/tickets/${id}/reply`,
    { reply },
    { timeout: 10000 },
  );
  const ticket = mapHelpTicket(data ?? {});
  if (!ticket) throw new Error("Invalid help ticket response.");
  return ticket;
}
