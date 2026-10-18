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
import HallDetailsHeader from "@/components/halls/HallDetailsHeader";
import HallDetailsOverview from "@/components/halls/HallDetailsOverview";
import HallHourlyBookingSection from "@/components/halls/hourly/HallHourlyBookingSection";
import type { HourlySummarySelection } from "@/hooks/useHourlyBooking";
import HallYouTubeEmbed from "@/components/halls/HallYouTubeEmbed";
import HallReviewsSection from "@/components/halls/HallReviewsSection";
import HallUnavailableOverlay from "@/components/halls/HallUnavailableOverlay";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useBookButtonBehavior } from "@/hooks/useBookButtonBehavior";
import { useHallAvailabilityInvalidation } from "@/hooks/useHallAvailabilityInvalidation";
import { useHallDetails } from "@/hooks/useHallDetails";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useT } from "@/i18n";
import { sanitizeWhatsAppHref } from "@/lib/ai-chat-whatsapp";
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
  const [hourlySummary, setHourlySummary] = useState<HourlySummarySelection | null>(null);
  const openHourlyConfirm = useRef<(() => void) | null>(null);
  const registerHourlyConfirm = useCallback((open: () => void) => {
    openHourlyConfirm.current = open;
  }, []);
  const showHourlySummary = useCallback((selection: HourlySummarySelection | null) => {
    setHourlySummary(selection);
    if (!selection) return;
    requestAnimationFrame(() => {
      document.querySelector("[data-testid='hall-action-card']")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);
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
  const featureLabels = uniqueFeatureLabels(viewHall.features, viewHall.amenities);
  const notes = hallNotes(viewHall.otherFeatures, t("halls.details.summaryPriceNote"));
  const detailedAddress = viewHall.detailedAddress?.trim() || viewHall.location;
  const sections = [
    detailedAddress
      ? { id: "hall-address", label: t("halls.details.tabs.address") }
      : null,
    featureLabels.length
      ? { id: "hall-details-features", label: t("halls.details.tabs.features") }
      : null,
    notes.length
      ? { id: "hall-notes", label: t("halls.details.tabs.notes") }
      : null,
    !isOwnHall
      ? { id: "hall-inquiry", label: t("halls.details.tabs.inquiry") }
      : null,
  ].filter((section): section is { id: string; label: string } => section != null);

  if (unavailable) {
    return (
      <div className="hall-details-page relative min-w-0 pb-12 sm:pb-16">
        <div className="pointer-events-none select-none blur-[2px] opacity-55" aria-hidden="true">
          <HallDetailsHeader hall={viewHall} sections={[]} part="title" />
          <div className="mt-6">
            <HallDetailsOverview hall={viewHall} />
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

      <HallDetailsHeader key={`${viewHall.id}-title`} hall={viewHall} sections={[]} part="title" />

      <HallDetailsOverview key={viewHall.id} hall={viewHall} />

      <section
        className="space-y-6 rounded-[28px] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,45,0.04)] sm:p-5"
        data-testid="hall-details-info"
      >
        <HallDetailsHeader key={`${viewHall.id}-tabs`} hall={viewHall} sections={sections} part="tabs" />

        {detailedAddress ? (
          <section
            id="hall-address"
            className="scroll-mt-28 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="hall-full-description"
          >
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--wesal-text)]">
                <PinIcon />
                {t("halls.details.tabs.address")}
              </h2>
              <p className="mt-3 text-sm leading-8 text-[var(--wesal-text)]">{detailedAddress}</p>
            </div>
            <AskMabroukAboutHallButton
              hallId={viewHall.id}
              hallName={viewHall.name}
              className="!w-[12.5rem] max-w-full shrink-0"
            />
          </section>
        ) : null}

        {featureLabels.length > 0 ? (
          <div id="hall-details-features" className="scroll-mt-28" data-testid="hall-features">
            <h2 className="text-lg font-bold text-[var(--wesal-text)]">
              {t("halls.details.tabs.features")}
            </h2>
            <HallAmenitiesGrid amenities={featureLabels} embedded />
          </div>
        ) : null}

        {notes.length > 0 || !isOwnHall ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {notes.length > 0 ? (
              <section id="hall-notes" className="scroll-mt-28">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--wesal-text)]">
                  <InfoIcon />
                  {t("halls.details.tabs.notes")}
                </h2>
                <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-7 text-[var(--wesal-text)]">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!isOwnHall ? (
              <HallInquiryActions
                hallId={viewHall.id}
                hallName={viewHall.name}
                ownerPhone={viewHall.ownerPhone}
                isOwnHall={isOwnHall}
                isAvailable={!unavailable}
              />
            ) : null}
          </div>
        ) : null}
      </section>

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
                onConfirmed={showHourlySummary}
                onRegisterConfirm={registerHourlyConfirm}
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
              location={viewHall.location}
              capacity={viewHall.capacity}
              capacityMax={viewHall.capacityMax}
              slotPrices={viewHall.slotPrices}
              selectedDateLabel={hourlySummary?.dateLabel}
              selectedPeriodLabels={hourlySummary ? [hourlySummary.timeLabel] : []}
              onConfirm={() => {
                if (showCalendar) {
                  openHourlyConfirm.current?.();
                  return;
                }
                handleBook();
              }}
              confirmDisabled={showCalendar && !hourlySummary}
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

function uniqueFeatureLabels(features: string[] | undefined, amenities: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const label of [...(features ?? []), ...amenities]) {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    labels.push(trimmed);
  }
  return labels;
}

function HallInquiryActions({
  hallId,
  hallName,
  ownerPhone,
  isOwnHall,
  isAvailable,
}: {
  hallId: string;
  hallName: string;
  ownerPhone?: string | null;
  isOwnHall: boolean;
  isAvailable: boolean;
}) {
  const t = useT();
  const message = t("halls.details.whatsappPrefill", { name: hallName });
  const whatsappHref = ownerPhone ? ownerWhatsAppHref(ownerPhone, message) : null;
  const phone = ownerPhone?.trim() ?? "";
  const [phoneCopied, setPhoneCopied] = useState(false);

  const copyPhone = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setPhoneCopied(true);
      window.setTimeout(() => setPhoneCopied(false), 2000);
    } catch {
      setPhoneCopied(false);
    }
  };

  return (
    <section id="hall-inquiry" className="scroll-mt-28">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--wesal-text)]">
        <PhoneIcon />
        {t("halls.details.tabs.inquiry")}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
        {t("halls.details.inquiryHint")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <HallContactButton
          hallId={hallId}
          isOwnHall={isOwnHall}
          isAvailable={isAvailable}
          variant="compact"
          label={t("halls.details.inquiryMessages")}
        />
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("halls.details.inquiryWhatsAppAria")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1ebe5d]"
          >
            <WhatsAppIcon />
            {t("halls.details.inquiryWhatsApp")}
          </a>
        ) : null}
        {phone ? (
          <span
            dir="ltr"
            className="inline-flex h-9 items-center rounded-full border border-[var(--wesal-border)] bg-white text-xs font-bold text-[var(--wesal-text)] transition hover:border-[var(--wesal-maroon)] hover:shadow-sm"
          >
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex h-full items-center gap-1.5 rounded-s-full ps-3.5 pe-2 transition hover:bg-[var(--wesal-pink)] hover:text-[var(--wesal-maroon)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
            >
              <PhoneIcon className="size-3.5" />
              {phone}
            </a>
            <button
              type="button"
              onClick={() => void copyPhone()}
              aria-label={phoneCopied ? t("halls.details.phoneCopied") : t("halls.details.copyPhone")}
              title={phoneCopied ? t("halls.details.phoneCopied") : t("halls.details.copyPhone")}
              data-testid="hall-phone-copy"
              className="inline-flex h-full items-center rounded-e-full border-s border-[var(--wesal-border)] px-2.5 text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
            >
              {phoneCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </span>
        ) : null}
      </div>
    </section>
  );
}

function ownerWhatsAppHref(phone: string, message: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith("5")) digits = `970${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  const base = sanitizeWhatsAppHref(digits);
  if (!base) return null;
  const text = message.trim().slice(0, 300);
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M6 16H5.5A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V6" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden="true">
      <path d="m6 12 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={`${className} text-[var(--wesal-maroon)]`} aria-hidden="true">
      <path
        d="M8.2 4.8h2.1l1.1 2.6-1.3 1.1a12.2 12.2 0 0 0 5.4 5.4l1.1-1.3 2.6 1.1v2.1c0 .8-.6 1.5-1.4 1.6A14.6 14.6 0 0 1 6.6 6.2c.1-.8.8-1.4 1.6-1.4Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 3.2A8.7 8.7 0 0 0 4.5 16.7L3.4 20.6l4-1.05A8.7 8.7 0 1 0 12.04 3.2Zm5.05 12.3c-.21.6-1.23 1.14-1.7 1.21-.44.07-.99.1-1.6-.1-.37-.12-.84-.27-1.45-.53-2.55-1.1-4.2-3.67-4.33-3.84-.12-.17-1.04-1.38-1.04-2.63s.66-1.86.9-2.12c.23-.25.51-.32.68-.32h.49c.16 0 .37-.06.58.44.21.52.72 1.8.78 1.93.06.13.1.28.02.45-.08.17-.12.28-.24.43-.12.15-.25.33-.36.44-.12.12-.24.25-.1.48.13.23.6.99 1.29 1.6.88.79 1.63 1.03 1.86 1.15.23.12.37.1.5-.06.14-.17.58-.67.73-.9.15-.23.31-.19.52-.11.21.07 1.34.63 1.57.75.23.11.38.17.44.27.06.1.06.57-.15 1.17Z"
      />
    </svg>
  );
}

function hallNotes(otherFeatures: string | null | undefined, priceNote: string): string[] {
  const notes = [priceNote];
  const extra = otherFeatures?.trim();
  if (!extra) return notes;
  for (const line of extra.split(/\n+/)) {
    const trimmed = line.replace(/^[-•]\s*/, "").trim();
    if (trimmed && !notes.includes(trimmed)) notes.push(trimmed);
  }
  return notes;
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5 text-[var(--wesal-maroon)]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5 text-[var(--wesal-maroon)]"
      aria-hidden="true"
    >
      <path d="M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}
