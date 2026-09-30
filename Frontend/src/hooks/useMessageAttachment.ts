"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

function attachmentRequestPath(
  conversationId: string,
  messageId: string,
  rawUrl?: string | null,
): string {
  const raw = (rawUrl ?? "").trim();
  const match = raw.match(/\/conversations\/[^/]+\/messages\/[^/]+\/attachment/i);
  if (match) return match[0];
  return `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachment`;
}

export function useMessageAttachment(
  conversationId: string | null,
  messageId: string | null,
  enabled: boolean,
  rawUrl?: string | null,
) {
  const scopedConversation = conversationId?.trim() || null;
  const scopedMessage = messageId?.trim() || null;
  const active = enabled && scopedConversation !== null && scopedMessage !== null;
  // One key per request so a stale result can never be shown for a newer message.
  const requestKey = active ? `${scopedConversation}|${scopedMessage}|${rawUrl ?? ""}` : null;
  const [result, setResult] = useState<AttachmentResult | null>(null);

  useEffect(() => {
    if (!requestKey || !scopedConversation || !scopedMessage) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void api
      .get<Blob>(attachmentRequestPath(scopedConversation, scopedMessage, rawUrl), {
        responseType: "blob",
        timeout: 15000,
      })
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || (typeof Blob !== "undefined" && data.size === 0)) {
          setResult({ key: requestKey, url: null, status: "error" });
          return;
        }
        objectUrl = URL.createObjectURL(data);
        setResult({ key: requestKey, url: objectUrl, status: "ready" });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ key: requestKey, url: null, status: "error" });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rawUrl, requestKey, scopedConversation, scopedMessage]);

  // Derive from the current key: results for a previous request are ignored.
  if (!requestKey) return { url: null, status: "idle" as const };
  if (result?.key === requestKey) return { url: result.url, status: result.status };
  return { url: null, status: "loading" as const };
}

type AttachmentResult = {
  key: string;
  url: string | null;
  status: "ready" | "error";
};
