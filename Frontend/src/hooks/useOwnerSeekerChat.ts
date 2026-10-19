"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { conversationMessagesPath } from "@/constants/seekerDashboardNav";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import { fetchInboxConversations } from "@/services/conversations";

/**
 * Opens the owner ↔ seeker thread for a hall (used after reject so the owner
 * can talk to the requester). Picks the inbox row for that hall + requester.
 */
export function useOwnerSeekerChat() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const openWithSeeker = useCallback(
    async (hallId: string, requesterUserId?: string | null) => {
      const hall = hallId.trim();
      if (!hall || opening) return;
      setOpening(true);
      try {
        const items = await fetchInboxConversations();
        const requester = requesterUserId?.trim().toLowerCase() || "";
        const hallKey = hall.toLowerCase();
        const match =
          items.find(
            (item) =>
              item.hallId.trim().toLowerCase() === hallKey &&
              requester &&
              item.otherParticipantId.trim().toLowerCase() === requester &&
              !isOwnerAdminConversation(item, items),
          ) ??
          items.find(
            (item) =>
              item.hallId.trim().toLowerCase() === hallKey &&
              !isOwnerAdminConversation(item, items),
          );
        router.push(
          conversationMessagesPath("HallOwner", {
            hallId: hall,
            conversationId: match?.conversationId,
          }),
        );
      } catch {
        router.push(conversationMessagesPath("HallOwner", { hallId: hall }));
      } finally {
        setOpening(false);
      }
    },
    [opening, router],
  );

  return { openWithSeeker, opening };
}
