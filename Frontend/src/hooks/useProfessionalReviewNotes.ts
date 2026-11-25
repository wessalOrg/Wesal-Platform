"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { isCurrentNotificationAccount, type NotificationAccount } from "@/lib/notification-account";
import {
  professionalReviewNotesBody,
  professionalReviewNotesFromThread,
} from "@/lib/professional-review-notes";
import {
  fetchConversationThread,
  fetchMyAdminAccountConversation,
} from "@/services/conversations";
import type { ProfessionalAccountPhase } from "@/types/account-approval";

/**
 * Durable Admin review notes for Rejected / NeedsChanges on the professional dashboard.
 * Rejection reason comes from GET /notifications; NeedsChanges notes from the Admin thread.
 */
export function useProfessionalReviewNotes(phase: ProfessionalAccountPhase) {
  // Reuse the same account-scoped inbox request as the navbar instead of a second,
  // independently merging request that could survive an account transition.
  const { account } = useNotifications("seeker");
  const [result, setResult] = useState<{
    account: NotificationAccount; phase: ProfessionalAccountPhase; notes: string | null;
  } | null>(null);

  const fromInbox =
    phase === "rejected" || phase === "needs_changes"
      ? professionalReviewNotesBody(phase)
      : null;

  // NeedsChanges notes live in the Admin conversation (not the notification body).
  // Rejection also posts the reason there — use as fallback when inbox is empty.
  useEffect(() => {
    if (!account || (phase !== "rejected" && phase !== "needs_changes") || fromInbox) return;

    let cancelled = false;
    const current = () => !cancelled && isCurrentNotificationAccount(account);
    void (async () => {
      let notes: string | null = null;
      try {
        const admin = await fetchMyAdminAccountConversation();
        if (current() && admin?.conversationId) {
          const thread = await fetchConversationThread(admin.conversationId);
          notes = professionalReviewNotesFromThread(thread.messages, account.userId);
        }
      } catch {
        // The notification inbox remains available when the conversation is unavailable.
      } finally {
        if (current()) setResult({ account, phase, notes });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, phase, fromInbox]);

  const resolved = result?.account === account && result?.phase === phase;
  const threadNotes = resolved ? result.notes : null;
  const notes = fromInbox || threadNotes;
  const loading = Boolean(account && (phase === "rejected" || phase === "needs_changes") && !resolved);
  return {
    notes,
    loading: loading && !notes,
    source: fromInbox ? ("notification" as const) : notes ? ("conversation" as const) : null,
  };
}
