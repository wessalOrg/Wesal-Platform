"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { chatImageValidationError } from "@/lib/chat-image-message";
import { useChatAttachmentPreview } from "@/hooks/useChatAttachmentPreview";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import {
  isOwnerAdminConversation,
  pickOwnerAdminConversation,
} from "@/lib/owner-admin-conversation";
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
  focusAdmin?: boolean;
};

function createAttachmentSendLock(account: AuthenticatedAccount | null) {
  const pending = new Set<string>();
  return {
    start(id: string) {
      if (!isCurrentAuthenticatedAccount(account) || pending.has(id)) return false;
      pending.add(id); return true;
    },
    finish(id: string) { pending.delete(id); },
  };
}

function readWindowFocus(pathname: string): {
  hallId: string | null;
  conversationId: string | null;
  contactAdmin: boolean;
} {
  if (typeof window === "undefined" || !pathname.startsWith("/owner/messages")) {
    return { hallId: null, conversationId: null, contactAdmin: false };
  }
  const query = new URLSearchParams(window.location.search);
  return {
    hallId: query.get("hallId")?.trim() || null,
    conversationId: query.get("conversation_id")?.trim() || null,
    contactAdmin: query.get("contact") === "admin",
  };
}

/**
 * Thread focus + attachment state for a messaging surface.
 *
 * Deep-links an owner ↔ Admin thread by hallId, and exposes the image attachment control for
 * whichever thread is selected — the owner ↔ Admin payment screenshot and the seeker ↔ owner
 * booking deposit receipt both go through POST /conversations/{id}/messages/attachment.
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
  focusAdmin: focusAdminProp,
}: UseAdminChatOptions) {
  const pathname = usePathname();
  const { isHallOwner } = useAccountAccess();
  const fromWindow = readWindowFocus(pathname);
  const focusHallId = focusHallIdProp !== undefined ? focusHallIdProp : fromWindow.hallId;
  const focusConversationId =
    focusConversationIdProp !== undefined ? focusConversationIdProp : fromWindow.conversationId;
  const focusAdmin = focusAdminProp !== undefined ? focusAdminProp : fromWindow.contactAdmin;
  const [file, setFile] = useState<File | null>(null);
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const sendLock = useMemo(() => createAttachmentSendLock(account), [account]);
  const previewUrl = useChatAttachmentPreview(file);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const draftScope = useMemo(() => ({ account, selectedId, file }), [account, selectedId, file]);
  const activeDraft = useRef<typeof draftScope | null>(null);
  useLayoutEffect(() => {
    activeDraft.current = draftScope;
    return () => { activeDraft.current = null; };
  }, [draftScope]);

  const matchedConversation = useMemo(() => {
    if (focusAdmin) {
      const admin = pickOwnerAdminConversation(conversations, focusHallId);
      if (admin) return admin;
      if (!focusConversationId) return null;
      const byId =
        conversations.find((item) => item.conversationId === focusConversationId) ?? null;
      if (byId && isOwnerAdminConversation(byId)) return byId;
      return null;
    }
    if (focusConversationId) {
      return (
        conversations.find((item) => item.conversationId === focusConversationId) ?? null
      );
    }
    if (!focusHallId) return null;
    return pickOwnerAdminConversation(conversations, focusHallId);
  }, [conversations, focusAdmin, focusConversationId, focusHallId]);

  useEffect(() => {
    if (focusAdmin) {
      if (!isHallOwner) return;
      if (inboxStatus !== "ready" && inboxStatus !== "empty") return;
      if (!matchedConversation) return;
      if (selectedId === matchedConversation.conversationId) return;
      selectConversation(matchedConversation.conversationId);
      return;
    }
    if (focusConversationId) {
      if (selectedId !== focusConversationId) selectConversation(focusConversationId);
      return;
    }
    if (!isHallOwner || !focusHallId) return;
    if (inboxStatus !== "ready" && inboxStatus !== "empty") return;
    if (!matchedConversation) return;
    if (selectedId === matchedConversation.conversationId) return;
    selectConversation(matchedConversation.conversationId);
  }, [
    focusAdmin,
    focusConversationId,
    focusHallId,
    inboxStatus,
    isHallOwner,
    matchedConversation,
    selectConversation,
    selectedId,
  ]);

  // Keep the intended image control for all participants. The server still authorizes uploads
  // and currently rejects CustomerProvider images; that restriction is surfaced, never bypassed.
  const canAttach = Boolean(selectedId) && Boolean(sendAttachment);

  const missingConversation =
    isHallOwner &&
    Boolean(focusAdmin || focusHallId || focusConversationId) &&
    !selectedId &&
    (inboxStatus === "ready" || inboxStatus === "empty") &&
    !matchedConversation;

  const clearAttachment = useCallback(() => {
    setFile(null);
    setAttachmentBusy(false);
  }, []);

  // Clear the draft before rendering a different account/conversation. URL
  // cleanup belongs exclusively to the preview hook, after DOM replacement.
  const [boundSelectedId, setBoundSelectedId] = useState(selectedId);
  const [boundAccount, setBoundAccount] = useState(account);
  if (boundSelectedId !== selectedId || boundAccount !== account) {
    setBoundSelectedId(selectedId);
    setBoundAccount(account);
    setFile(null);
    setAttachmentBusy(false);
    setErrorKey(null);
  }

  const pickAttachment = useCallback(
    (next: File) => {
      if (!canAttach || !isCurrentAuthenticatedAccount(account) ||
          activeDraft.current?.account !== account || activeDraft.current.selectedId !== selectedId) return;
      const validationError = chatImageValidationError(next);
      if (validationError) {
        setErrorKey(validationError);
        return;
      }
      setErrorKey(null);
      setFile(next);
      setAttachmentBusy(false);
    },
    [account, canAttach, selectedId],
  );

  const sendWithAttachment = useCallback(
    async (text: string) => {
      if (file && sendAttachment) {
        if (!selectedId || activeDraft.current !== draftScope || !sendLock.start(selectedId)) return;
        setAttachmentBusy(true);
        setErrorKey(null);
        try {
          const sent = await sendAttachment(file, text);
          if (activeDraft.current !== draftScope) return;
          if (sent) {
            clearAttachment();
          } else {
            setErrorKey("errors.send.failed");
          }
        } catch {
          if (activeDraft.current === draftScope) setErrorKey("errors.send.failed");
        } finally {
          sendLock.finish(selectedId);
          if (activeDraft.current === draftScope) setAttachmentBusy(false);
        }
        return;
      }
      await sendMessage(text);
    },
    [clearAttachment, draftScope, file, selectedId, sendAttachment, sendLock, sendMessage],
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
