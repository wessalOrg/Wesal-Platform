"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import HallActionCard from "@/components/halls/HallActionCard";
import HallAmenitiesGrid from "@/components/halls/HallAmenitiesGrid";
import HallDetailsError from "@/components/halls/HallDetailsError";
import HallDetailsSkeleton from "@/components/halls/HallDetailsSkeleton";
import HallHeroGallery from "@/components/halls/HallHeroGallery";
import HallInlineBookingSection, {
  type HallInlineBookingSelection,
} from "@/components/halls/HallInlineBookingSection";
import HallQuickInfo from "@/components/halls/HallQuickInfo";
import HallReviewsSection from "@/components/halls/HallReviewsSection";
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
import { localizeHallDetail, localizeReviews } from "@/lib/localize-hall-display";
import {
  fetchHallComments,
  mapCommentToReview,
} from "@/services/comments";
import { toYouTubeEmbedUrl } from "@/lib/youtube-embed";
import { DEMO_HALL_REVIEWS } from "@/constants/hallDetailsFallback";
import type { HallReview } from "@/types/hall";

type HallDetailsPageProps = {
  hallId: string;
};

const EMPTY_SELECTION: HallInlineBookingSelection = {
  dateIso: null,
  dateLabel: "",
  periodLabels: [],
  submitting: false,
  success: false,
  canConfirm: false,
  submit: () => undefined,
  errorText: null,
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

  const [reviews, setReviews] = useState<HallReview[]>([]);
  const [bookingSelection, setBookingSelection] =
    useState<HallInlineBookingSelection>(EMPTY_SELECTION);
  const bookIntentHandled = useRef(false);

  const isOwnHall = permissions.isOwnHall;
  const { canBook, isGuest, authReady } = permissions;
  const shouldOpenBooking = hasBookingIntent(searchParams);
  const showBookingUi = Boolean(canBook && !unavailable && !isOwnHall);

  useEffect(() => {
    return () => resetBodyScrollLock();
  }, []);

  useEffect(() => {
    bookIntentHandled.current = false;
    setBookingSelection(EMPTY_SELECTION);
  }, [hallId]);

  useEffect(() => {
    let active = true;
    setReviews([]);
    void fetchHallComments(hallId).then((comments) => {
      if (!active) return;
      if (comments != null && comments.length > 0) {
        setReviews(comments.map(mapCommentToReview));
        return;
      }
      setReviews(localizeReviews(DEMO_HALL_REVIEWS, lang));
    });
    return () => {
      active = false;
    };
  }, [hallId, lang]);

  const focusBookingSection = useCallback(() => {
    const node = document.getElementById("hall-booking-section");
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const { handleBook, loginHref, registerHref } = useBookButtonBehavior({
    hallId,
    hydrated: authReady,
    canBook,
    unavailable,
    onOpenBooking: focusBookingSection,
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
      focusBookingSection();
      router.replace(buildHallDetailsPath(hallId), { scroll: false });
    });
  }, [
    authReady,
    canBook,
    shouldOpenBooking,
    state.phase,
    unavailable,
    hall,
    focusBookingSection,
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
  return (
    <div className="hall-details-page min-w-0 space-y-6 pb-12 sm:space-y-8 sm:pb-16">
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

      <HallHeroGallery
        images={viewHall.gallery}
        hallName={viewHall.name}
        description={viewHall.description}
      />

      <HallQuickInfo hall={viewHall} />

      {viewHall.detailedAddress ? (
        <div
          className="rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--wesal-text)]"
          data-testid="hall-detailed-address"
        >
          {t("halls.details.detailedAddress")}:{" "}
          <span className="font-semibold">{viewHall.detailedAddress}</span>
        </div>
      ) : null}

      {viewHall.features && viewHall.features.length > 0 ? (
        <div
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
          data-testid="hall-features"
        >
          <p className="text-xs font-semibold text-[var(--wesal-muted)]">
            {t("halls.details.features")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {viewHall.features.map((feature) => (
              <li
                key={feature}
                className="rounded-full bg-[var(--wesal-pink)] px-3 py-1 text-xs font-semibold text-[var(--wesal-maroon)]"
              >
                {feature}
              </li>
            ))}
          </ul>
          {viewHall.otherFeatures ? (
            <p className="mt-3 text-sm leading-6 text-[var(--wesal-text)]">
              {t("halls.details.otherFeatures")}: {viewHall.otherFeatures}
            </p>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const embedUrl = toYouTubeEmbedUrl(viewHall.youtubeVideoUrl);
        return embedUrl ? (
          <div
            className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
            data-testid="hall-youtube"
          >
            <p className="mb-2 text-xs font-semibold text-[var(--wesal-muted)]">
              {t("halls.details.youtube")}
            </p>
            <div className="aspect-video overflow-hidden rounded-xl border border-[var(--wesal-border)]">
              <iframe
                src={embedUrl}
                title={t("halls.details.youtube")}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        ) : null;
      })()}

      <div className="hall-details-body min-w-0 space-y-5 lg:space-y-6">
        {showBookingUi ? (
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-5">
            <div className="order-2 min-w-0 w-full flex-1 lg:order-1">
              <HallInlineBookingSection
                hallId={viewHall.id}
                days={viewHall.availabilityDays ?? []}
                canSubmit={canBook}
                active={showBookingUi}
                onSelectionChange={setBookingSelection}
              />
            </div>
            <div className="order-1 w-full shrink-0 lg:order-2 lg:w-[17.5rem]">
              <HallActionCard
                hallName={viewHall.name}
                capacity={viewHall.capacity}
                capacityMax={viewHall.capacityMax}
                slotPrices={viewHall.slotPrices}
                selectedDateLabel={bookingSelection.dateLabel || null}
                selectedPeriodLabels={bookingSelection.periodLabels}
                onConfirm={() => {
                  if (bookingSelection.canConfirm) {
                    bookingSelection.submit();
                    return;
                  }
                  handleBook();
                }}
                confirmDisabled={!bookingSelection.canConfirm}
                confirmPending={bookingSelection.submitting}
                confirmSuccess={bookingSelection.success}
                confirmError={bookingSelection.errorText}
                disabled={unavailable}
                bookPending={!authReady}
                isGuest={isGuest}
                canBook={canBook}
                loginHref={loginHref}
                registerHref={registerHref}
                onGuestAuthNavigate={preserveGuestBookingContext}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-[20rem] lg:ms-auto">
            <HallActionCard
              hallName={viewHall.name}
              capacity={viewHall.capacity}
              capacityMax={viewHall.capacityMax}
              slotPrices={viewHall.slotPrices}
              selectedDateLabel={bookingSelection.dateLabel || null}
              selectedPeriodLabels={bookingSelection.periodLabels}
              onConfirm={() => {
                if (bookingSelection.canConfirm) {
                  bookingSelection.submit();
                  return;
                }
                handleBook();
              }}
              confirmDisabled={!bookingSelection.canConfirm}
              confirmPending={bookingSelection.submitting}
              confirmSuccess={bookingSelection.success}
              confirmError={bookingSelection.errorText}
              disabled={unavailable}
              bookPending={!authReady}
              isGuest={isGuest}
              canBook={canBook}
              loginHref={loginHref}
              registerHref={registerHref}
              onGuestAuthNavigate={preserveGuestBookingContext}
            />
          </div>
        )}

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

        <HallReviewsSection
          hallId={viewHall.id}
          isHallOwner={isOwnHall}
          rating={viewHall.rating}
          reviewCount={viewHall.reviewCount}
          comments={reviews}
          onCommentSubmitted={(review) => {
            setReviews((current) => [review, ...current]);
          }}
        />
      </div>
    </div>
  );
}