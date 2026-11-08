"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import {
  professionalReviewNotesBody,
  professionalReviewNotesFromThread,
} from "@/lib/professional-review-notes";
import {
  readPlatformNotificationsSnapshot,
  replacePlatformNotifications,
  subscribePlatformNotifications,
} from "@/lib/platform-notifications-store";
import {
  fetchConversationThread,
  fetchMyAdminAccountConversation,
} from "@/services/conversations";
import {
  fetchServerNotifications,
  notificationsUseMock,
} from "@/services/notifications";
import type { ProfessionalAccountPhase } from "@/types/account-approval";

/**
 * Durable Admin review notes for Rejected / NeedsChanges on the professional dashboard.
 * Rejection reason comes from GET /notifications; NeedsChanges notes from the Admin thread.
 */
export function useProfessionalReviewNotes(phase: ProfessionalAccountPhase) {
  const { userId } = useAccountAccess();
  const [threadNotes, setThreadNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useSyncExternalStore(
    subscribePlatformNotifications,
    readPlatformNotificationsSnapshot,
    () => "",
  );

  const fromInbox =
    phase === "rejected" || phase === "needs_changes"
      ? professionalReviewNotesBody(phase)
      : null;

  // Keep the durable inbox warm so rejection reasons survive after login/refresh.
  useEffect(() => {
    if (phase !== "rejected" && phase !== "needs_changes") return;
    if (notificationsUseMock()) return;
    let cancelled = false;
    void fetchServerNotifications()
      .then((items) => {
        if (!cancelled) replacePlatformNotifications(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // NeedsChanges notes live in the Admin conversation (not the notification body).
  // Rejection also posts the reason there — use as fallback when inbox is empty.
  useEffect(() => {
    if (phase !== "rejected" && phase !== "needs_changes") {
      setThreadNotes(null);
      return;
    }
    if (phase === "rejected" && fromInbox) {
      setThreadNotes(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const admin = await fetchMyAdminAccountConversation();
        if (cancelled || !admin?.conversationId) {
          if (!cancelled) setThreadNotes(null);
          return;
        }
        const thread = await fetchConversationThread(admin.conversationId);
        if (cancelled) return;
        setThreadNotes(
          professionalReviewNotesFromThread(thread.messages, userId),
        );
      } catch {
        if (!cancelled) setThreadNotes(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, fromInbox, userId]);

  const notes = fromInbox || threadNotes;
  return {
    notes,
    loading: loading && !notes,
    source: fromInbox ? ("notification" as const) : notes ? ("conversation" as const) : null,
  };
}
