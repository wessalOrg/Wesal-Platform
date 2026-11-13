"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import DeleteCommentDialog from "@/components/posts/DeleteCommentDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";
import { getCurrentUserId, isSameUserId } from "@/lib/current-user";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  POST_COMMENT_MAX_LENGTH,
  createPostComment,
  deletePostComment,
  fetchPostCommentReplies,
  fetchPostComments,
  replyToPostComment,
} from "@/services/post-interactions";
import type { PostComment } from "@/types/posts";

type PostCommentSectionProps = {
  postId: string;
  className?: string;
  onTotalChange?: (total: number) => void;
};

export default function PostCommentSection({
  postId,
  className = "",
  onTotalChange,
}: PostCommentSectionProps) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const currentUserId = getCurrentUserId();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [repliesByParent, setRepliesByParent] = useState<
    Record<string, PostComment[]>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<{
    comment: PostComment;
    parentId?: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPostComments(postId, 1, 30);
      setComments(page.items);
      setTotalCount(page.totalCount || page.items.length);
      onTotalChange?.(page.totalCount || page.items.length);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [onTotalChange, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadReplies(comment: PostComment) {
    const open = !expanded[comment.id];
    setExpanded((prev) => ({ ...prev, [comment.id]: open }));
    if (!open || repliesByParent[comment.id]) return;
    try {
      const page = await fetchPostCommentReplies(postId, comment.id, 1, 30);
      setRepliesByParent((prev) => ({ ...prev, [comment.id]: page.items }));
    } catch {
      /* keep collapsed on failure */
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!session.isAuthenticated) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/posts/${encodeURIComponent(postId)}`)}`,
      );
      return;
    }
    if (text.length > POST_COMMENT_MAX_LENGTH) {
      setErrorKey("posts.comments.errors.tooLong");
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      if (replyTo) {
        const created = await replyToPostComment(postId, replyTo.id, text);
        const parentId = created.parentCommentId || replyTo.id;
        setRepliesByParent((prev) => ({
          ...prev,
          [parentId]: [...(prev[parentId] ?? []), created],
        }));
        setComments((prev) =>
          prev.map((row) =>
            row.id === parentId
              ? { ...row, replyCount: row.replyCount + 1 }
              : row,
          ),
        );
        setExpanded((prev) => ({ ...prev, [parentId]: true }));
        setReplyTo(null);
        setTotalCount((prev) => {
          const next = prev + 1;
          onTotalChange?.(next);
          return next;
        });
      } else {
        const created = await createPostComment(postId, text);
        setComments((prev) => [created, ...prev]);
        setTotalCount((prev) => {
          const next = prev + 1;
          onTotalChange?.(next);
          return next;
        });
      }
      setDraft("");
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        router.push(
          `/login?redirect=${encodeURIComponent(`/posts/${encodeURIComponent(postId)}`)}`,
        );
      } else {
        setErrorKey(
          err instanceof ApiError
            ? err.message
            : replyTo
              ? "posts.comments.errors.replyFailed"
              : "posts.comments.errors.createFailed",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deletePostComment(postId, pendingDelete.comment.id);
      if (pendingDelete.parentId) {
        setRepliesByParent((prev) => ({
          ...prev,
          [pendingDelete.parentId!]: (prev[pendingDelete.parentId!] ?? []).filter(
            (row) => row.id !== pendingDelete.comment.id,
          ),
        }));
        setComments((prev) =>
          prev.map((row) =>
            row.id === pendingDelete.parentId
              ? { ...row, replyCount: Math.max(0, row.replyCount - 1) }
              : row,
          ),
        );
      } else {
        setComments((prev) => prev.filter((row) => row.id !== pendingDelete.comment.id));
      }
      setTotalCount((prev) => {
        const next = Math.max(0, prev - 1);
        onTotalChange?.(next);
        return next;
      });
      setPendingDelete(null);
    } catch {
      setErrorKey("posts.comments.errors.deleteFailed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className={`space-y-4 ${className}`.trim()}
      data-testid="post-comment-section"
    >
      <div className="flex items-center gap-2">
        <ChatBubbleIcon />
        <h2 className="text-base font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("posts.comments.titleWithCount", { count: totalCount })}
        </h2>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]/40 p-3"
      >
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs text-[var(--wesal-muted)]">
            <span>
              {t("posts.comments.replyingTo", { name: replyTo.authorName })}
            </span>
            <button
              type="button"
              className="font-bold text-[var(--wesal-maroon)]"
              onClick={() => setReplyTo(null)}
            >
              {t("posts.comments.cancelReply")}
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <textarea
            className="wesal-input !min-h-11 h-11 flex-1 resize-none !rounded-xl !bg-white !py-2.5 leading-normal hover:border-[var(--wesal-maroon-soft)] focus:border-[var(--wesal-maroon)] focus-visible:border-[var(--wesal-maroon)]"
            maxLength={POST_COMMENT_MAX_LENGTH}
            value={draft}
            disabled={busy}
            rows={1}
            placeholder={t("posts.comments.placeholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn-primary inline-flex h-11 min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 px-3 text-xs"
            disabled={busy || !draft.trim()}
            aria-label={t("posts.comments.send")}
          >
            <SendIcon />
            {busy ? t("posts.comments.sending") : t("posts.comments.send")}
          </button>
        </div>
        {errorKey ? (
          <p className="mt-2 text-xs text-[#b42318]" role="alert">
            {errorKey.startsWith("posts.") ? t(errorKey) : errorKey}
          </p>
        ) : null}
      </form>

      {status === "loading" ? (
        <p className="text-sm text-[var(--wesal-muted)]">{t("posts.comments.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-[#b42318]">{t("posts.comments.errors.loadFailed")}</p>
      ) : null}
      {status === "ready" && comments.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white px-4 py-8 text-center"
          data-testid="post-comments-empty"
        >
          <ChatBubbleIcon className="h-8 w-8 text-[var(--wesal-maroon)]/50" />
          <p className="text-sm font-semibold text-[var(--wesal-maroon-dark)]">
            {t("posts.comments.emptyTitle")}
          </p>
          <p className="text-xs text-[var(--wesal-muted)]">{t("posts.comments.empty")}</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li
            key={comment.id}
            className="rounded-2xl border border-[var(--wesal-border)] bg-white p-3"
          >
            <CommentRow
              comment={comment}
              canDelete={isSameUserId(comment.authorUserId, currentUserId)}
              onReply={() => setReplyTo(comment)}
              onDelete={() => setPendingDelete({ comment, parentId: null })}
              onToggleReplies={() => {
                void loadReplies(comment);
              }}
              expanded={Boolean(expanded[comment.id])}
            />
            {expanded[comment.id] && (repliesByParent[comment.id]?.length ?? 0) > 0 ? (
              <ul className="mt-3 space-y-2 border-s border-[var(--wesal-border)] ps-3">
                {(repliesByParent[comment.id] ?? []).map((reply) => (
                  <li key={reply.id} className="rounded-xl bg-[var(--wesal-pink-soft)] p-2.5">
                    <CommentRow
                      comment={reply}
                      canDelete={isSameUserId(reply.authorUserId, currentUserId)}
                      onReply={() => setReplyTo(comment)}
                      onDelete={() =>
                        setPendingDelete({ comment: reply, parentId: comment.id })
                      }
                      compact
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      <DeleteCommentDialog
        open={Boolean(pendingDelete)}
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </section>
  );
}

function CommentRow({
  comment,
  onReply,
  onDelete,
  onToggleReplies,
  expanded,
  canDelete,
  compact = false,
}: {
  comment: PostComment;
  onReply: () => void;
  onDelete?: () => void;
  onToggleReplies?: () => void;
  expanded?: boolean;
  canDelete?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const time = formatRelativeTime(comment.createdAt);

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-pink)] text-xs font-bold text-[var(--wesal-maroon)]">
          {comment.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.authorAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (comment.authorName.trim().charAt(0) || "?").toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className={`font-bold text-[var(--wesal-maroon-dark)] ${compact ? "text-xs" : "text-sm"}`}>
              {comment.authorName}
            </p>
            {time ? (
              <span className="text-[0.65rem] text-[var(--wesal-muted)]">{time}</span>
            ) : null}
          </div>
          <p className={`mt-0.5 whitespace-pre-wrap text-[var(--wesal-text)] ${compact ? "text-xs" : "text-sm"}`}>
            {comment.text}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.7rem] text-[var(--wesal-muted)] sm:gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-bold text-[var(--wesal-maroon)]"
              onClick={onReply}
            >
              {t("posts.comments.reply")}
            </button>
            {canDelete && onDelete ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center font-bold text-[#a86267]"
                onClick={onDelete}
                data-testid={`delete-comment-${comment.id}`}
              >
                {t("posts.comments.delete")}
              </button>
            ) : null}
            {!compact && comment.replyCount > 0 && onToggleReplies ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center font-bold"
                onClick={onToggleReplies}
              >
                {expanded
                  ? t("posts.comments.hideReplies")
                  : t("posts.comments.showReplies", { count: comment.replyCount })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubbleIcon({ className = "h-4 w-4 text-[var(--wesal-maroon)]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-5 3V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 19 4l-4.5 16-3.2-5.8L4 11.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
