"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import HallActionCard from "@/components/halls/HallActionCard";
import HallAmenitiesGrid from "@/components/halls/HallAmenitiesGrid";
import HallBookingPanel from "@/components/halls/HallBookingPanel";
import HallCommentList from "@/components/halls/HallCommentList";
import HallCommentPanel from "@/components/halls/HallCommentPanel";
import HallContactButton from "@/components/halls/HallContactButton";
import HallDetailsError from "@/components/halls/HallDetailsError";
import HallDetailsSkeleton from "@/components/halls/HallDetailsSkeleton";
import HallGalleryContainer from "@/components/halls/HallGalleryContainer";
import HallGuestFeedbackPrompt from "@/components/halls/HallGuestFeedbackPrompt";
import HallHeader from "@/components/halls/HallHeader";
import HallRatingPanel from "@/components/halls/HallRatingPanel";
import HallUnavailableBanner from "@/components/halls/HallUnavailableBanner";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useBookButtonBehavior } from "@/hooks/useBookButtonBehavior";
import { useHallAvailabilityInvalidation } from "@/hooks/useHallAvailabilityInvalidation";
import { useHallDetails } from "@/hooks/useHallDetails";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useT } from "@/i18n";
import { buildHallDetailsPath, hasBookingIntent } from "@/lib/booking-intent";
import { saveBookingHallContext } from "@/lib/auth-storage";
import { resetBodyScrollLock } from "@/lib/body-scroll-lock";
import { localizeHallDetail } from "@/lib/localize-hall-display";
import {
  fetchHallComments,
  mapCommentToReview,
} from "@/services/comments";
import type { HallReview } from "@/types/hall";

type HallDetailsPageProps = {
  hallId: string;
};

export default function HallDetailsPage({ hallId }: HallDetailsPageProps) {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, hall, unavailable, usingFallback, errorMessage, retry, refreshQuiet } =
    useHallDetails(hallId);
  const permissions = useHallPermissions(hall);

  useHallAvailabilityInvalidation(hallId, refreshQuiet);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [reviews, setReviews] = useState<HallReview[]>([]);
  const bookIntentHandled = useRef(false);

  const isOwnHall = permissions.isOwnHall;
  const { canBook, canContactOwner, isGuest, authReady } = permissions;
  const shouldOpenBooking = hasBookingIntent(searchParams);

  useEffect(() => {
    if (canBook) return;
    setBookingOpen(false);
  }, [canBook]);

  useEffect(() => {
    return () => resetBodyScrollLock();
  }, []);

  useEffect(() => {
    bookIntentHandled.current = false;
  }, [hallId]);

  useEffect(() => {
    let active = true;
    setReviews([]);
    void fetchHallComments(hallId).then((comments) => {
      if (!active || comments == null) return;
      setReviews(comments.map(mapCommentToReview));
    });
    return () => {
      active = false;
    };
  }, [hallId]);

  const openBookingFlow = useCallback(() => {
    setBookingOpen(true);
  }, []);

  const { handleBook, loginHref, registerHref } = useBookButtonBehavior({
    hallId,
    hydrated: authReady,
    canBook,
    unavailable,
    onOpenBooking: openBookingFlow,
  });

  const preserveGuestBookingContext = useCallback(() => {
    saveBookingHallContext(hallId);
  }, [hallId]);

  useEffect(() => {
    if (!authReady || !canBook || !shouldOpenBooking || bookIntentHandled.current) {
      return;
    }
    if (state.phase !== "ready" || unavailable || !hall) return;

    bookIntentHandled.current = true;
    queueMicrotask(() => {
      openBookingFlow();
      router.replace(buildHallDetailsPath(hallId), { scroll: false });
    });
  }, [
    authReady,
    canBook,
    shouldOpenBooking,
    state.phase,
    unavailable,
    hall,
    openBookingFlow,
    hallId,
    router,
  ]);

  if (state.phase === "loading") {
    return <HallDetailsSkeleton />;
  }

  if (state.phase === "fatal") {
    return (
      <div className="space-y-4">
        <HallDetailsError message={state.message} onRetry={retry} />
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
        >
          {t("common.backHome")}
        </Link>
      </div>
    );
  }

  if (state.phase === "ready" && state.result.status === "not_found") {
    return (
      <HallDetailsError
        message={t("halls.details.notFound")}
        onRetry={retry}
      />
    );
  }

  if (!hall) {
    return (
      <HallDetailsError
        message={t("halls.details.unexpected")}
        onRetry={retry}
      />
    );
  }

  const viewHall = localizeHallDetail(hall, lang);
  const showActions = !unavailable && !isOwnHall;

  return (
    <div className="hall-details-page min-w-0 space-y-6 pb-10 sm:space-y-8 sm:pb-14">
      {usingFallback ? (
        <div
          className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-center sm:text-start"
          role="status"
          data-testid="hall-details-fallback-notice"
        >
          <p className="text-sm text-[var(--wesal-text)]">
            {t("halls.details.offline")}
            {errorMessage ? ` (${errorMessage})` : ""}
          </p>
          <button type="button" onClick={retry} className="btn-outline mt-3">
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {unavailable ? <HallUnavailableBanner hallName={viewHall.name} /> : null}

      <HallGalleryContainer images={viewHall.gallery} hallName={viewHall.name} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] lg:items-start lg:gap-8">
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <HallHeader hall={viewHall} />

          <section aria-labelledby="hall-description-heading">
            <h2
              id="hall-description-heading"
              className="text-lg font-bold text-[var(--wesal-maroon)] sm:text-xl"
            >
              {t("halls.details.about")}
            </h2>
            <p className="mt-3 text-sm leading-8 text-[var(--wesal-text)] sm:text-base">
              {viewHall.description}
            </p>
          </section>

          <HallAmenitiesGrid amenities={viewHall.amenities} />

          {isOwnHall ? (
            <p
              className="rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm leading-7 text-[var(--wesal-muted)]"
              data-testid="hall-actions-owner"
              role="status"
            >
              {t("halls.details.ownerBanner")}
            </p>
          ) : null}

          <section aria-labelledby="hall-reviews-heading">
            <h2
              id="hall-reviews-heading"
              className="text-lg font-bold text-[var(--wesal-maroon)] sm:text-xl"
            >
              {t("halls.details.reviews")}
            </h2>

            <HallRatingPanel
              hallId={viewHall.id}
              isHallOwner={isOwnHall}
            />

            <HallCommentPanel
              hallId={viewHall.id}
              isHallOwner={isOwnHall}
              onSubmitted={(review) => {
                setReviews((current) => [review, ...current]);
              }}
            />

            <HallCommentList comments={reviews} />

            <HallGuestFeedbackPrompt
              hallId={viewHall.id}
              isHallOwner={isOwnHall}
            />
          </section>
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-[4.75rem] lg:z-[1] lg:self-start">
          <HallActionCard
            slotPrices={viewHall.slotPrices}
            onBook={handleBook}
            disabled={unavailable}
            bookPending={!authReady}
            isGuest={isGuest}
            canBook={canBook}
            showContact={showActions && canContactOwner}
            loginHref={loginHref}
            registerHref={registerHref}
            onGuestAuthNavigate={preserveGuestBookingContext}
            contactSlot={
              showActions ? (
                <HallContactButton
                  hallId={viewHall.id}
                  isOwnHall={isOwnHall}
                  isAvailable={!unavailable}
                />
              ) : null
            }
          />
        </div>
      </div>

      {canBook && !unavailable ? (
        <HallBookingPanel
          open={bookingOpen}
          hallId={viewHall.id}
          hallName={viewHall.name}
          days={viewHall.availabilityDays ?? []}
          canSubmit={canBook}
          onClose={() => setBookingOpen(false)}
        />
      ) : null}
    </div>
  );
}
