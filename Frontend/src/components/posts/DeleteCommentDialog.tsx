"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n";

type DeleteCommentDialogProps = {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteCommentDialog({
  open,
  busy = false,
  onConfirm,
  onCancel,
}: DeleteCommentDialogProps) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(45,28,24,0.42)] p-4"
      role="presentation"
      data-testid="delete-comment-dialog-overlay"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-comment-title"
        className="w-full max-w-[22rem] rounded-[1.25rem] bg-white px-5 py-6 text-center shadow-[0_24px_48px_rgba(90,55,45,0.22)]"
        data-testid="delete-comment-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
          aria-hidden="true"
        >
          <TrashIcon />
        </span>
        <h2
          id="delete-comment-title"
          className="mt-4 text-lg font-extrabold text-[var(--wesal-maroon-dark)]"
        >
          {t("posts.comments.deleteTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--wesal-muted)]">
          {t("posts.comments.deleteBody")}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            data-testid="delete-comment-confirm"
            onClick={onConfirm}
          >
            {busy ? t("common.loading") : t("posts.comments.deleteConfirm")}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn-outline w-full"
            disabled={busy}
            data-testid="delete-comment-cancel"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7m-7.5 0 .7 11.2A1.8 1.8 0 0 0 10 20h4a1.8 1.8 0 0 0 1.8-1.8L16.5 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
