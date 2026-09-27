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
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    enabled && scopedConversation && scopedMessage ? "loading" : "idle",
  );

  useEffect(() => {
    if (!enabled || !scopedConversation || !scopedMessage) {
      setUrl(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setStatus("loading");
    setUrl(null);

    void api
      .get<Blob>(attachmentRequestPath(scopedConversation, scopedMessage, rawUrl), {
        responseType: "blob",
        timeout: 15000,
      })
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || (typeof Blob !== "undefined" && data.size === 0)) {
          setStatus("error");
          return;
        }
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setUrl(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, rawUrl, scopedConversation, scopedMessage]);

  return { url, status };
}
