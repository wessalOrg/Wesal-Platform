"use client";

import { useState } from "react";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useProtectedHallError } from "@/hooks/useProtectedHallError";
import { useT } from "@/i18n";
import {
  COMMENT_MAX_LENGTH,
  commentErrorMessage,
  mapCommentToReview,
  submitHallComment,
  validateCommentBody,
} from "@/services/comments";
import type { HallReview } from "@/types/hall";

type HallCommentPanelProps = {
  hallId: string;
  isHallOwner: boolean;
  onSubmitted?: (review: HallReview) => void;
};

export default function HallCommentPanel({
  hallId,
  isHallOwner,
  onSubmitted,
}: HallCommentPanelProps) {
  const t = useT();
  const { authReady, canComment } = useHallPermissions({ isOwner: isHallOwner });
  const handleProtectedError = useProtectedHallError();

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!authReady) {
    return (
      <div
        className="mt-4 h-20 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
        aria-busy="true"
        data-testid="hall-comment-loading"
      />
    );
  }

  if (!canComment) {
    return null;
  }

  const submit = async () => {
    if (submitting) return;

    const validationError = validateCommentBody(body);
    if (validationError) {
      setError(validationError);
      setSuccess(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const saved = await submitHallComment(hallId, body);
      setBody("");
      setSuccess(true);
      onSubmitted?.(mapCommentToReview(saved));
    } catch (err) {
      setError(await handleProtectedError(err, commentErrorMessage));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="mt-4 rounded-2xl bg-[#f7f1ec] px-4 py-5 shadow-[0_12px_30px_rgba(110,60,55,0.08)] sm:px-6 sm:py-6"
      data-testid="hall-comment-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor="hall-comment-body"
        className="block text-center text-base font-bold text-[var(--wesal-maroon)] sm:text-start"
      >
        {t("halls.comment.title")}
      </label>
      <textarea
        id="hall-comment-body"
        className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[#eadfd6] bg-white px-3 py-3 text-sm leading-7 text-[#4a403c] outline-none transition focus:border-[var(--wesal-maroon)] focus:ring-2 focus:ring-[var(--wesal-maroon)]/15 disabled:opacity-60"
        placeholder={t("halls.comment.placeholder")}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={submitting}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "hall-comment-error" : undefined}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setSuccess(false);
          if (error) setError(null);
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#8a7a70]">
        <span>
          {body.trim().length}/{COMMENT_MAX_LENGTH}
        </span>
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="btn-primary min-h-11 w-full !rounded-xl !px-4 !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:w-auto sm:min-h-12"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner />
              {t("halls.comment.submitting")}
            </span>
          ) : (
            t("halls.comment.submit")
          )}
        </button>
      </div>
      {error ? (
        <div
          id="hall-comment-error"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          data-testid="hall-comment-error"
        >
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold underline"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      {success ? (
        <p
          className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]"
          role="status"
          data-testid="hall-comment-success"
        >
          {t("halls.comment.saved")}
        </p>
      ) : null}
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.4"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
