"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { isAcceptedChatImage } from "@/lib/chat-image-message";
import { pickOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

type UseAdminChatOptions = {
  conversations: ConversationSummary[];
  selectedId: string | null;
  inboxStatus: InboxStatus;
  selectConversation: (conversationId: string | null) => void;
  sendMessage: (text: string) => Promise<boolean>;
  sendAttachment?: (file: File, text: string) => Promise<boolean>;
  focusHallId?: string | null;
  focusConversationId?: string | null;
};

function readWindowFocus(pathname: string): {
  hallId: string | null;
  conversationId: string | null;
} {
  if (typeof window === "undefined" || !pathname.startsWith("/owner/messages")) {
    return { hallId: null, conversationId: null };
  }
  const query = new URLSearchParams(window.location.search);
  return {
    hallId: query.get("hallId")?.trim() || null,
    conversationId: query.get("conversation_id")?.trim() || null,
  };
}

/**
 * Owner ↔ Admin thread: deep-link by hallId and send a payment screenshot
 * via POST /conversations/{id}/messages/attachment.
 */
export function useAdminChat({
  conversations,
  selectedId,
  inboxStatus,
  selectConversation,
  sendMessage,
  sendAttachment,
  focusHallId: focusHallIdProp,
  focusConversationId: focusConversationIdProp,
}: UseAdminChatOptions) {
  const pathname = usePathname();
  const { isHallOwner } = useAccountAccess();
  const fromWindow = readWindowFocus(pathname);
  const focusHallId = focusHallIdProp !== undefined ? focusHallIdProp : fromWindow.hallId;
  const focusConversationId =
    focusConversationIdProp !== undefined ? focusConversationIdProp : fromWindow.conversationId;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const matchedConversation = useMemo(() => {
    if (focusConversationId) {
      const exact = conversations.find((item) => item.conversationId === focusConversationId);
      if (exact) return exact;
    }
    if (!focusHallId) return null;
    return pickOwnerAdminConversation(conversations, focusHallId);
  }, [conversations, focusConversationId, focusHallId]);

  useEffect(() => {
    if (!isHallOwner || (!focusHallId && !focusConversationId)) return;
    if (inboxStatus !== "ready" && inboxStatus !== "empty") return;
    if (!matchedConversation) return;
    if (selectedId === matchedConversation.conversationId) return;
    selectConversation(matchedConversation.conversationId);
  }, [
    focusConversationId,
    focusHallId,
    inboxStatus,
    isHallOwner,
    matchedConversation,
    selectConversation,
    selectedId,
  ]);

  const canAttach =
    isHallOwner && Boolean(selectedId) && Boolean(sendAttachment);

  const missingConversation =
    isHallOwner &&
    Boolean(focusHallId || focusConversationId) &&
    !selectedId &&
    (inboxStatus === "ready" || inboxStatus === "empty") &&
    !matchedConversation;

  const clearAttachment = useCallback(() => {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(() => {
    clearAttachment();
    setErrorKey(null);
  }, [clearAttachment, selectedId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickAttachment = useCallback(
    (next: File) => {
      if (!canAttach) return;
      if (!isAcceptedChatImage(next)) {
        setErrorKey("messages.attachInvalid");
        return;
      }
      setErrorKey(null);
      setFile(next);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(next);
      });
    },
    [canAttach],
  );

  const sendWithAttachment = useCallback(
    async (text: string) => {
      if (file && sendAttachment) {
        setAttachmentBusy(true);
        setErrorKey(null);
        try {
          const sent = await sendAttachment(file, text);
          if (sent) {
            clearAttachment();
          } else {
            setErrorKey("errors.send.failed");
          }
        } catch {
          setErrorKey("errors.send.failed");
        } finally {
          setAttachmentBusy(false);
        }
        return;
      }
      await sendMessage(text);
    },
    [clearAttachment, file, sendAttachment, sendMessage],
  );

  return {
    focusHallId,
    canAttach,
    missingConversation,
    attachmentPreviewUrl: previewUrl,
    attachmentName: file?.name ?? null,
    attachmentBusy,
    errorKey,
    pickAttachment: canAttach ? pickAttachment : undefined,
    clearAttachment,
    sendWithAttachment,
  };
}
