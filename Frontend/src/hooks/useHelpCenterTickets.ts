"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createHelpTicket,
  getHelpTicket,
  getHelpTicketsServerSnapshot,
  getHelpTicketsSnapshot,
  replyToHelpTicket,
  subscribeHelpCenter,
} from "@/lib/help-center-storage";
import type { HelpTicket } from "@/types/help-center";

const isClientSnapshot = () => true;
const isServerSnapshot = () => false;

/**
 * Local (browser-storage) Help Center tickets. Subscribes to the storage change
 * event so every mounted consumer stays in sync without effect-driven setState.
 */
export function useHelpCenterTickets() {
  const tickets = useSyncExternalStore(
    subscribeHelpCenter,
    getHelpTicketsSnapshot,
    getHelpTicketsServerSnapshot,
  );
  // False during SSR/hydration, true once the browser snapshot is in use.
  const ready = useSyncExternalStore(subscribeHelpCenter, isClientSnapshot, isServerSnapshot);

  const submitQuestion = useCallback(
    (input: { userId: string; userName: string; question: string }): HelpTicket =>
      createHelpTicket(input),
    [],
  );

  const reply = useCallback(
    (id: string, content: string): HelpTicket | null => replyToHelpTicket(id, content),
    [],
  );

  const getById = useCallback((id: string) => getHelpTicket(id), []);

  return { tickets, ready, submitQuestion, reply, getById };
}
