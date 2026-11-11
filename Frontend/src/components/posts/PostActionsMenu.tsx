"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useStartContentConversation } from "@/hooks/useStartContentConversation";
import { useT } from "@/i18n";
import { fetchPostShareLink, recordPostShare } from "@/services/posts";

type PostActionsMenuProps = {
  postId: string;
  profileHref: string | null;
  onCopied?: () => void;
};

/** Figma overflow menu: copy link, message page, open profile. */
export default function PostActionsMenu({
  postId,
  profileHref,
  onCopied,
}: PostActionsMenuProps) {
  const t = useT();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const { start, starting } = useStartContentConversation();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyLink() {
    if (copyBusy) return;
    setCopyBusy(true);
    try {
      const link = await fetchPostShareLink(postId);
      await navigator.clipboard.writeText(link);
      void recordPostShare(postId);
      onCopied?.();
      setOpen(false);
    } catch {
      /* keep menu open on failure */
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)] transition hover:border-[var(--wesal-maroon)] hover:text-[var(--wesal-maroon)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("posts.menu.open")}
        data-testid="post-actions-menu-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 top-[calc(100%+0.4rem)] z-20 min-w-[14rem] overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_16px_36px_rgba(90,55,45,0.14)]"
          data-testid="post-actions-menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)]"
            disabled={copyBusy}
            onClick={() => {
              void copyLink();
            }}
          >
            <LinkIcon />
            {copyBusy ? t("posts.share.copying") : t("posts.share.copyLink")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)]"
            disabled={starting}
            data-testid="post-menu-message-page"
            onClick={() => {
              setOpen(false);
              void start("post", postId);
            }}
          >
            <ChatIcon />
            {starting ? t("posts.inquiry.starting") : t("posts.menu.messagePage")}
          </button>
          {profileHref ? (
            <Link
              href={profileHref}
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)]"
              onClick={() => setOpen(false)}
            >
              <UserIcon />
              {t("posts.menu.openProfile")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-5 3V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
