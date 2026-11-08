"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { conversationMessagesPath } from "@/constants/seekerDashboardNav";
import { isUnauthorizedApiError } from "@/lib/api-error";
import { buildProfessionalContactLoginRedirectPath } from "@/lib/auth-storage";
import {
  conversationErrorMessage,
  createProfessionalConversation,
} from "@/services/conversations";

/**
 * Starts or reuses POST /professionals/{providerUserId}/conversations, then opens
 * the thread in the messages inbox (or seeker messages page as fallback).
 */
export function useStartProfessionalConversation() {
  const router = useRouter();
  const inbox = useOptionalMessagesInbox();
  const { session } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const start = useCallback(
    async (
      providerUserId: string,
      options?: {
        onOpened?: () => void;
        loginHref?: string;
      },
    ) => {
      const id = providerUserId.trim();
      if (!id || inFlight.current || starting) return null;
      inFlight.current = true;
      setStarting(true);
      setError(null);
      try {
        const thread = await createProfessionalConversation(id);
        options?.onOpened?.();
        if (inbox?.canUseMessaging) {
          inbox.openInbox(thread.conversationId);
          return thread;
        }
        router.push(
          conversationMessagesPath(session.role, {
            conversationId: thread.conversationId,
          }),
        );
        return thread;
      } catch (err) {
        if (isUnauthorizedApiError(err)) {
          router.push(
            options?.loginHref ?? buildProfessionalContactLoginRedirectPath(id),
          );
          return null;
        }
        setError(conversationErrorMessage(err, "start"));
        return null;
      } finally {
        inFlight.current = false;
        setStarting(false);
      }
    },
    [inbox, router, session.role, starting],
  );

  return { start, starting, error };
}
