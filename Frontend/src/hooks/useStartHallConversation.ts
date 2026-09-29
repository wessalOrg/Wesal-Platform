"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useProtectedHallError } from "@/hooks/useProtectedHallError";
import { conversationMessagesPath } from "@/constants/seekerDashboardNav";
import { isUnauthorizedApiError } from "@/lib/api-error";
import { buildContactLoginRedirectPath } from "@/lib/auth-storage";
import { isHallLockedApiError } from "@/lib/hall-locked-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  conversationErrorMessage,
  createHallConversation,
} from "@/services/conversations";

/**
 * Starts or reuses POST /halls/{hallId}/conversations, then opens the inbox/thread.
 */
export function useStartHallConversation() {
  const router = useRouter();
  const inbox = useOptionalMessagesInbox();
  const { session } = useAuth();
  const handleProtectedError = useProtectedHallError();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false);

  const start = useCallback(
    async (
      hallId: string,
      options?: { onOpened?: () => void; loginHref?: string; draft?: string },
    ) => {
      if (!hallId || inFlight.current || starting) return null;
      inFlight.current = true;
      setStarting(true);
      setError(null);
      setBlocked(false);
      try {
        const thread = await createHallConversation(hallId);
        if (inbox?.canUseMessaging) {
          if (options?.draft?.trim()) {
            inbox.openInbox(thread.conversationId, options.draft);
            inbox.closeInbox();
          } else {
            inbox.selectConversation(thread.conversationId);
          }
        }
        options?.onOpened?.();
        router.push(
          conversationMessagesPath(session.role, {
            conversationId: thread.conversationId,
            hallId: thread.hallId || hallId,
          }),
        );
        return thread;
      } catch (err) {
        if (isHallLockedApiError(err) || isSystemLockedApiError(err)) {
          setBlocked(true);
          setError(null);
          return null;
        }
        const message = await handleProtectedError(err, conversationErrorMessage);
        if (isUnauthorizedApiError(err)) {
          router.push(options?.loginHref ?? buildContactLoginRedirectPath(hallId));
          return null;
        }
        setError(message);
        return null;
      } finally {
        inFlight.current = false;
        setStarting(false);
      }
    },
    [handleProtectedError, inbox, router, session.role, starting],
  );

  const dismissBlocked = useCallback(() => setBlocked(false), []);

  return { start, starting, error, blocked, dismissBlocked };
}
