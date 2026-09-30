"use client";

import { useEffect, useState } from "react";
import { GoldStars } from "@/components/ui/GoldStar";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useProtectedHallError } from "@/hooks/useProtectedHallError";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { getCurrentUserId, isSameUserId } from "@/lib/current-user";
import { readProfileAvatar } from "@/lib/profile-avatar";
import {
  COMMENT_MAX_LENGTH,
  commentActionErrorMessage,
  deleteHallComment,
  mapCommentToReview,
  updateHallComment,
  validateCommentBody,
} from "@/services/comments";
import type { HallReview } from "@/types/hall";

type HallCommentListProps = {
  comments: HallReview[];
  onCommentUpdated?: (review: HallReview) => void;
  onCommentDeleted?: (commentId: string) => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function HallCommentList({
  comments,
  onCommentUpdated,
  onCommentDeleted,
}: HallCommentListProps) {
  const t = useT();
  const { ready, authenticated, userId } = useAccountAccess();
  const handleProtectedError = useProtectedHallError();
  const [pendingDelete, setPendingDelete] = useState<HallReview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <p
        className="mt-4 text-center text-sm leading-7 text-[#8a7a70]"
        data-testid="hall-comments-empty"
      >
        {t("halls.comment.empty")}
      </p>
    );
  }

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteHallComment(pendingDelete.id);
      onCommentDeleted?.(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(await handleProtectedError(err, (error) => commentActionErrorMessage(error, "delete")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ul className="hall-comments-list divide-y divide-[#eee4dc]" data-testid="hall-comments-list">
        {comments.map((review) => (
          <CommentItem
            key={review.id}
            review={review}
            isOwner={
              ready &&
              authenticated &&
              Boolean(review.userId) &&
              isSameUserId(review.userId ?? "", userId || getCurrentUserId())
            }
            onUpdated={(next) => onCommentUpdated?.(next)}
            onDelete={() => {
              setDeleteError(null);
              setPendingDelete(review);
            }}
          />
        ))}
      </ul>
      <DeleteCommentDialog
        open={pendingDelete != null}
        busy={deleting}
        error={deleteError}
        onClose={() => {
          if (deleting) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </>
  );
}

function CommentAvatar({
  name,
  userId,
  avatarUrl,
}: {
  name: string;
  userId?: string | null;
  avatarUrl?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const remote = avatarUrl?.trim() || "";
  const local = !remote && userId ? readProfileAvatar(userId) : null;
  const src = remote || local || "";
  const broken = !src || failedSrc === src;

  if (broken) {
    return (
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-xs font-extrabold text-[var(--wesal-maroon)]"
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}

function CommentItem({
  review,
  isOwner,
  onUpdated,
  onDelete,
}: {
  review: HallReview;
  isOwner: boolean;
  onUpdated: (review: HallReview) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const handleProtectedError = useProtectedHallError();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    const validationError = validateCommentBody(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateHallComment(review.id, draft);
      onUpdated(mapCommentToReview(saved));
      setEditing(false);
    } catch (err) {
      setError(await handleProtectedError(err, (failure) => commentActionErrorMessage(failure, "edit")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-4" data-testid={`hall-comment-${review.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CommentAvatar name={review.author} userId={review.userId} avatarUrl={review.avatarUrl} />
          <div className="min-w-0 text-start">
            <p className="truncate text-[15px] font-bold text-[var(--wesal-text)]">{review.author}</p>
            {review.timeAgo ? <p className="text-xs text-[#b0a39c]">{review.timeAgo}</p> : null}
          </div>
        </div>
        {review.rating != null ? (
          <div className="shrink-0">
            <GoldStars rating={review.rating} size={13} />
          </div>
        ) : null}
      </div>

      {editing ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="sr-only" htmlFor={`hall-comment-edit-${review.id}`}>
            {t("halls.comment.editLabel")}
          </label>
          <textarea
            id={`hall-comment-edit-${review.id}`}
            className="min-h-28 w-full resize-y rounded-xl border border-[#eadfd6] bg-white px-3 py-3 text-sm leading-7 text-[#4a403c] outline-none transition focus:border-[var(--wesal-maroon)] focus:ring-2 focus:ring-[var(--wesal-maroon)]/15 disabled:opacity-60"
            value={draft}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={saving}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn-outline min-h-11 w-full sm:w-auto"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDraft(review.comment);
                setError(null);
              }}
            >
              {t("halls.comment.cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary min-h-11 w-full sm:w-auto"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? t("halls.comment.saving") : t("halls.comment.save")}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-line break-words text-start text-[15px] leading-7 text-[#4a403c]">
          {review.comment}
        </p>
      )}

      {isOwner && !editing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline min-h-11 px-4 text-sm"
            data-testid={`hall-comment-edit-${review.id}`}
            onClick={() => {
              setDraft(review.comment);
              setError(null);
              setEditing(true);
            }}
          >
            {t("halls.comment.edit")}
          </button>
          <button
            type="button"
            className="btn-outline min-h-11 px-4 text-sm"
            data-testid={`hall-comment-delete-${review.id}`}
            onClick={onDelete}
          >
            {t("halls.comment.delete")}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold underline"
            disabled={saving}
            onClick={() => void save()}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

function DeleteCommentDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130]" role="presentation" data-testid="hall-comment-delete-dialog">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("halls.comment.cancel")}
        disabled={busy}
        onClick={onClose}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hall-comment-delete-title"
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        >
          <div className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-4">
            <h2 id="hall-comment-delete-title" className="text-lg font-bold text-[var(--wesal-maroon)]">
              {t("halls.comment.deleteTitle")}
            </h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-7 text-[var(--wesal-text)]">{t("halls.comment.deleteConfirm")}</p>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-outline min-h-11 w-full sm:w-auto" disabled={busy} onClick={onClose}>
                {t("halls.comment.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary min-h-11 w-full sm:w-auto"
                disabled={busy}
                aria-busy={busy}
                data-testid="hall-comment-delete-confirm"
                onClick={onConfirm}
              >
                {busy ? t("halls.comment.deleting") : t("halls.comment.delete")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
