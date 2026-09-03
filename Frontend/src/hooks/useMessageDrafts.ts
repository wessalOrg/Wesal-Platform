"use client";

import { useCallback, useMemo, useState } from "react";
import {
  draftsStorageKey,
  readMessageDrafts,
  writeMessageDrafts,
} from "@/lib/message-drafts";

/**
 * Per-account composer drafts. Survives panel close, route changes, and
 * failed sends. Cleared when the signed-in account changes.
 */
export function useMessageDrafts(ownerKey: string | null) {
  const storageKey = ownerKey ? draftsStorageKey(ownerKey) : null;
  const [seenKey, setSeenKey] = useState<string | null>(storageKey);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    storageKey ? readMessageDrafts(storageKey) : {},
  );

  if (storageKey !== seenKey) {
    setSeenKey(storageKey);
    setDrafts(storageKey ? readMessageDrafts(storageKey) : {});
  }

  const setDraft = useCallback(
    (conversationId: string, value: string) => {
      if (!storageKey || !conversationId) return;
      setDrafts((current) => {
        const next = { ...current };
        if (value.trim()) next[conversationId] = value;
        else delete next[conversationId];
        writeMessageDrafts(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const restoreDraft = useCallback(
    (conversationId: string, value: string) => {
      if (!storageKey || !conversationId) return;
      if (!value.trim()) return;
      setDrafts((current) => {
        if ((current[conversationId] ?? "").trim()) return current;
        const next = { ...current, [conversationId]: value };
        writeMessageDrafts(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const draftFor = useCallback(
    (conversationId: string | null) => (conversationId ? drafts[conversationId] ?? "" : ""),
    [drafts],
  );

  return useMemo(
    () => ({ draftFor, setDraft, restoreDraft }),
    [draftFor, restoreDraft, setDraft],
  );
}
