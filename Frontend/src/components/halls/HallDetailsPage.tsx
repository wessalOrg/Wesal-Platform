"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AskMabroukAboutHallButton from "@/components/assistant/AskMabroukAboutHallButton";
import HallActionCard from "@/components/halls/HallActionCard";
import HallContactButton from "@/components/halls/HallContactButton";
import HallAmenitiesGrid from "@/components/halls/HallAmenitiesGrid";
import HallDetailsError from "@/components/halls/HallDetailsError";
import HallDetailsSkeleton from "@/components/halls/HallDetailsSkeleton";
import HallHeroGallery from "@/components/halls/HallHeroGallery";
import HallHourlyBookingSection from "@/components/halls/hourly/HallHourlyBookingSection";
import HallQuickInfo from "@/components/halls/HallQuickInfo";
import HallYouTubeEmbed from "@/components/halls/HallYouTubeEmbed";
import HallReviewsSection from "@/components/halls/HallReviewsSection";
import HallUnavailableOverlay from "@/components/halls/HallUnavailableOverlay";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useBookButtonBehavior } from "@/hooks/useBookButtonBehavior";
import { useHallAvailabilityInvalidation } from "@/hooks/useHallAvailabilityInvalidation";
import { useHallDetails } from "@/hooks/useHallDetails";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useT } from "@/i18n";
import { useStartHallConversation } from "@/hooks/useStartHallConversation";
import { buildHallDetailsPath, hasBookingIntent, hasContactIntent } from "@/lib/booking-intent";
import { saveBookingHallContext } from "@/lib/auth-storage";
import { resetBodyScrollLock } from "@/lib/body-scroll-lock";
import { localizeHallDetail, localizeReviews } from "@/lib/localize-hall-display";
import {
  fetchHallComments,
  mapCommentToReview,
} from "@/services/comments";
import { DEMO_HALL_REVIEWS } from "@/constants/hallDetailsFallback";
import { isDemoModeEnabled } from "@/lib/demo-mode";
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

  const [reviews, setReviews] = useState<HallReview[]>([]);
  const bookIntentHandled = useRef(false);
  const contactIntentHandled = useRef(false);
  const { start: startContact } = useStartHallConversation();

  const [prevReviewsScope, setPrevReviewsScope] = useState<string>(
    () => `${hallId}|${lang}`,
  );
  const reviewsScope = `${hallId}|${lang}`;
  if (prevReviewsScope !== reviewsScope) {
    setPrevReviewsScope(reviewsScope);
    setReviews([]);
  }

  const isOwnHall = permissions.isOwnHall;
  const { canBook, canContactOwner, isGuest, authReady } = permissions;
  const shouldOpenBooking = hasBookingIntent(searchParams);
  const shouldOpenContact = hasContactIntent(searchParams);
  const showCalendar = !unavailable;

  useEffect(() => {
    return () => resetBodyScrollLock();
  }, []);

  useEffect(() => {
    bookIntentHandled.current = false;
    contactIntentHandled.current = false;
  }, [hallId]);

  useEffect(() => {
    let active = true;
    void fetchHallComments(hallId).then((comments) => {
      if (!active) return;
      // null = comments API unreachable. Demo placeholder reviews only appear
      // when demo mode is explicitly enabled, never as failed-request residue.
      // An empty list is authoritative and must not be replaced by placeholders.
      if (comments == null) {
        setReviews(isDemoModeEnabled() ? localizeReviews(DEMO_HALL_REVIEWS, lang) : []);
        return;
      }
      setReviews(comments.map(mapCommentToReview));
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

  useEffect(() => {
    if (!authReady || !canContactOwner || !shouldOpenContact || contactIntentHandled.current) {
      return;
    }
    if (state.phase !== "ready" || !hall) return;

    contactIntentHandled.current = true;
    queueMicrotask(() => {
      void startContact(hallId);
    });
  }, [
    authReady,
    canContactOwner,
    shouldOpenContact,
    state.phase,
    hall,
    hallId,
    startContact,
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

  if (unavailable) {
    return (
      <div className="hall-details-page relative min-w-0 pb-12 sm:pb-16">
        <div className="pointer-events-none select-none blur-[2px] opacity-55" aria-hidden="true">
          <HallHeroGallery
            images={viewHall.gallery}
            hallName={viewHall.name}
            description={viewHall.description}
          />
          <div className="mt-6">
            <HallQuickInfo hall={viewHall} />
          </div>
        </div>
        <HallUnavailableOverlay hallName={viewHall.name} />
      </div>
    );
  }

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

      <HallHeroGallery
        images={viewHall.gallery}
        hallName={viewHall.name}
        description={viewHall.description}
      />

      <HallQuickInfo hall={viewHall} />

      {viewHall.description?.trim() ? (
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
          data-testid="hall-full-description"
        >
          <h2 className="text-base font-bold text-[var(--wesal-maroon)]">
            {t("halls.details.about")}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--wesal-text)] whitespace-pre-wrap">
            {viewHall.description}
          </p>
        </section>
      ) : null}

      {viewHall.ownerPhone || !isOwnHall ? (
        <div
          className={`hall-details-phone-row${
            viewHall.ownerPhone && !isOwnHall
              ? ""
              : viewHall.ownerPhone
                ? " hall-details-phone-row--phone-only"
                : " hall-details-phone-row--cta-only"
          }`}
          data-testid="hall-contact-phone-row"
        >
          {viewHall.ownerPhone ? (
            <p className="hall-details-phone-chip" data-testid="hall-contact-phone">
              {t("halls.details.contactPhone")}:{" "}
              <span dir="ltr">{viewHall.ownerPhone}</span>
            </p>
          ) : null}
          {!isOwnHall ? (
            <HallContactButton
              hallId={viewHall.id}
              isOwnHall={isOwnHall}
              isAvailable={!unavailable}
              variant="bubble"
            />
          ) : null}
        </div>
      ) : null}

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

      <HallYouTubeEmbed url={viewHall.youtubeVideoUrl} />

      <div className="hall-details-body min-w-0 space-y-5 lg:space-y-6">
        <div
          className={`hall-details-booking-row${
            showCalendar ? "" : " hall-details-booking-row--summary-only"
          }`}
        >
          {showCalendar ? (
            <div className="hall-details-booking-calendar order-2 lg:order-1">
              <HallHourlyBookingSection
                hallId={viewHall.id}
                hallName={viewHall.name}
                canSubmit={canBook}
              />
            </div>
          ) : null}
          <div
            className={`hall-details-booking-summary order-1 lg:order-2 ${
              showCalendar ? "" : "max-w-[20rem] lg:ms-auto"
            }`}
          >
            <HallActionCard
              hallName={viewHall.name}
              capacity={viewHall.capacity}
              capacityMax={viewHall.capacityMax}
              slotPrices={viewHall.slotPrices}
              onConfirm={handleBook}
              confirmDisabled={false}
              disabled={unavailable}
              bookPending={!authReady}
              isGuest={isGuest}
              canBook={canBook}
              loginHref={loginHref}
              registerHref={registerHref}
              onGuestAuthNavigate={preserveGuestBookingContext}
            />
            <AskMabroukAboutHallButton
              hallId={viewHall.id}
              hallName={viewHall.name}
              className="mt-3"
            />
          </div>
        </div>

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
          onCommentUpdated={(review) => {
            setReviews((current) =>
              current.map((item) => (item.id === review.id ? { ...item, ...review } : item)),
            );
          }}
          onCommentDeleted={(commentId) => {
            setReviews((current) => current.filter((item) => item.id !== commentId));
          }}
        />
      </div>
    </div>
  );
}
