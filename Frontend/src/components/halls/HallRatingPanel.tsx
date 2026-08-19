"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GoldStar } from "@/components/ui/GoldStar";
import {
  fetchHallRatingSummary,
  ratingErrorMessage,
  submitHallRating,
} from "@/services/ratings";

type HallRatingPanelProps = {
  hallId: string;
  isHallOwner: boolean;
  onRated?: (result: { averageRating: number; totalRatings: number }) => void;
};

export default function HallRatingPanel({
  hallId,
  isHallOwner,
  onRated,
}: HallRatingPanelProps) {
  const { session, status: authStatus } = useAuth();
  const role = session.role ?? "";
  const isOwnerRole = role.toLowerCase() === "hallowner" || isHallOwner;
  const canRate =
    session.isAuthenticated &&
    !isOwnerRole &&
    (role.toLowerCase() === "registereduser" || role.toLowerCase() === "admin");
  const isGuest = authStatus === "ready" && !session.isAuthenticated;

  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const [existing, setExisting] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!canRate) return;
    let active = true;
    void fetchHallRatingSummary(hallId).then((summary) => {
      if (!active || !summary?.userRating) return;
      setExisting(summary.userRating);
      setValue(summary.userRating);
    });
    return () => {
      active = false;
    };
  }, [canRate, hallId]);

  if (authStatus === "loading") {
    return (
      <div
        className="mt-5 h-24 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
        aria-busy="true"
        data-testid="hall-rating-loading"
      />
    );
  }

  if (isOwnerRole) {
    return null;
  }

  if (isGuest) {
    return null;
  }

  if (session.isAuthenticated && !canRate) {
    return (
      <p
        className="mt-4 text-center text-sm leading-7 text-[#8a7a70]"
        data-testid="hall-rating-restricted"
      >
        حسابك الحالي لا يسمح بإرسال تقييم.
      </p>
    );
  }

  const submit = async () => {
    if (value < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await submitHallRating(hallId, value, existing != null);
      setExisting(result.value);
      setSuccess(true);
      onRated?.({
        averageRating: result.averageRating,
        totalRatings: result.totalRatings,
      });
    } catch (err) {
      setError(ratingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="mt-4 rounded-2xl bg-[#f7f1ec] px-4 py-5 shadow-[0_12px_30px_rgba(110,60,55,0.08)] sm:px-6 sm:py-6"
      data-testid="hall-rating-control"
    >
      <p className="text-center text-base font-bold text-[var(--wesal-maroon)] sm:text-start">
        {existing ? "عدّلي تقييمك" : "قيّمي هذه القاعة"}
      </p>
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-1 sm:justify-start"
        role="radiogroup"
        aria-label="التقييم من 5"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hover || value) >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} من 5`}
              disabled={submitting}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-[var(--wesal-pink-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => {
                setValue(star);
                setSuccess(false);
                setError(null);
              }}
            >
              <span className={active ? "opacity-100" : "opacity-30"}>
                <GoldStar size={22} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          className="btn-primary min-h-11 w-full !rounded-xl !px-4 !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:w-auto sm:min-h-12"
          disabled={submitting || value < 1}
          onClick={() => void submit()}
        >
          {submitting ? "جاري الإرسال…" : existing ? "تحديث التقييم" : "إرسال التقييم"}
        </button>
        {value > 0 ? (
          <p className="text-sm text-[var(--wesal-muted)]">{value} من 5</p>
        ) : null}
      </div>
      {error ? (
        <div
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          data-testid="hall-rating-error"
        >
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold underline"
            onClick={() => void submit()}
            disabled={submitting || value < 1}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]" role="status">
          تم حفظ تقييمك.
        </p>
      ) : null}
    </div>
  );
}
