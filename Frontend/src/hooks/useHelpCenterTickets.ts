"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  createHelpTicket,
  getHelpTicket,
  getHelpTicketsServerSnapshot,
  getHelpTicketsSnapshot,
  hydrateHelpTicketsFromServer,
  markHelpConversationRead,
  markHelpTicketRead,
  replyToHelpTicket,
  subscribeHelpCenter,
  upsertHelpTicket,
} from "@/lib/help-center-storage";
import {
  helpTicketsUseMock,
  markHelpConversationReadOnServer,
  markHelpTicketReadOnServer,
  replyHelpTicket,
  submitHelpTicket,
} from "@/services/help-tickets";
import type { HelpTicket } from "@/types/help-center";

const isClientSnapshot = () => true;
const isServerSnapshot = () => false;

/**
 * Help Center tickets. Live sessions read/write the durable API and mirror the result into
 * the local cache; demo/stub sessions stay on the local store. `scope` selects the signed-in
 * user's own tickets ("mine") or the Admin queue ("all").
 */
export function useHelpCenterTickets(scope: "mine" | "all" = "mine") {
  const tickets = useSyncExternalStore(
    subscribeHelpCenter,
    getHelpTicketsSnapshot,
    getHelpTicketsServerSnapshot,
  );
  // False during SSR/hydration, true once the browser snapshot is in use.
  const ready = useSyncExternalStore(subscribeHelpCenter, isClientSnapshot, isServerSnapshot);

  useEffect(() => {
    void hydrateHelpTicketsFromServer(scope);
  }, [scope]);

  const submitQuestion = useCallback(
    async (input: { userId: string; userName: string; question: string }): Promise<HelpTicket> => {
      if (helpTicketsUseMock()) return createHelpTicket(input);
      const ticket = await submitHelpTicket({
        userName: input.userName,
        question: input.question,
      });
      upsertHelpTicket(ticket);
      return ticket;
    },
    [],
  );

  const reply = useCallback(async (id: string, content: string): Promise<HelpTicket | null> => {
    if (helpTicketsUseMock()) return replyToHelpTicket(id, content);
    const updated = await replyHelpTicket(id, content);
    upsertHelpTicket(updated);
    return updated;
  }, []);

  const markRead = useCallback(async (id: string) => {
    if (helpTicketsUseMock()) {
      markHelpTicketRead(id);
      return;
    }
    await markHelpTicketReadOnServer(id);
    markHelpTicketRead(id);
  }, []);

  const markConversationRead = useCallback(async (userId: string) => {
    if (helpTicketsUseMock()) {
      markHelpConversationRead(userId);
      return;
    }
    await markHelpConversationReadOnServer(userId);
    markHelpConversationRead(userId);
  }, []);

  const getById = useCallback((id: string) => getHelpTicket(id), []);

  return { tickets, ready, submitQuestion, reply, getById, markRead, markConversationRead };
}
