"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { conversationMessagesPath } from "@/constants/seekerDashboardNav";
import { isUnauthorizedApiError } from "@/lib/api-error";
import {
  conversationErrorMessage,
  startConversationFromOffer,
  startConversationFromPost,
} from "@/services/conversations";

type ContentKind = "post" | "offer";

/**
 * Starts POST /posts/{id}/conversation or POST /offers/{id}/conversation,
 * then opens the thread in the messages inbox (or messages route).
 */
export function useStartContentConversation() {
  const router = useRouter();
  const inbox = useOptionalMessagesInbox();
  const { session } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const start = useCallback(
    async (
      kind: ContentKind,
      contentId: string,
      options?: { onOpened?: () => void; loginHref?: string; draft?: string },
    ) => {
      if (!contentId || inFlight.current || starting) return null;
      inFlight.current = true;
      setStarting(true);
      setError(null);
      try {
        const thread =
          kind === "post"
            ? await startConversationFromPost(contentId)
            : await startConversationFromOffer(contentId);
        options?.onOpened?.();
        if (inbox?.canUseMessaging) {
          inbox.openInbox(thread.conversationId, options?.draft);
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
          const fallback =
            options?.loginHref ??
            `/login?redirect=${encodeURIComponent(
              kind === "post"
                ? `/posts/${encodeURIComponent(contentId)}`
                : `/discover?filter=Offers&offer=${encodeURIComponent(contentId)}`,
            )}`;
          router.push(fallback);
          return null;
        }
        setError(conversationErrorMessage(err));
        return null;
      } finally {
        inFlight.current = false;
        setStarting(false);
      }
    },
    [inbox, router, session.role, starting],
  );

  return { start, starting, error, clearError: () => setError(null) };
}
