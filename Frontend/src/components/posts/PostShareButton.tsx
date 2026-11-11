"use client";

import { useState } from "react";
import { useT } from "@/i18n";
import { fetchPostShareLink, recordPostShare } from "@/services/posts";

type PostShareButtonProps = {
  postId: string;
  className?: string;
  /** Prefer clipboard copy (Figma “نسخ رابط المنشور”) over native share sheet. */
  preferCopy?: boolean;
  onCopied?: () => void;
};

export default function PostShareButton({
  postId,
  className = "",
  preferCopy = true,
  onCopied,
}: PostShareButtonProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const link = await fetchPostShareLink(postId);
      if (!preferCopy && typeof navigator.share === "function") {
        try {
          await navigator.share({ url: link, title: t("posts.share.title") });
          void recordPostShare(postId);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(link);
      void recordPostShare(postId);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--wesal-muted)] transition hover:border-[var(--wesal-maroon)] hover:text-[var(--wesal-maroon)] ${className}`.trim()}
      disabled={busy}
      onClick={() => {
        void share();
      }}
      data-testid="post-share-button"
    >
      <ShareIcon />
      {copied ? t("posts.share.copied") : t("posts.share.label")}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.2 10.8 7.6-4.2M8.2 13.2l7.6 4.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
