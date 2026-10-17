"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GoldStars } from "@/components/ui/GoldStar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import AskMabroukAboutHallButton from "@/components/assistant/AskMabroukAboutHallButton";
import HallGallery from "@/components/halls/HallGallery";
import HallCommentList from "@/components/halls/HallCommentList";
import HallAmenitiesGrid from "@/components/halls/HallAmenitiesGrid";
import HallAddReviewCard from "@/components/halls/HallAddReviewCard";
import HallLockedBadge from "@/components/halls/HallLockedBadge";
import HallUnavailableDialog from "@/components/halls/HallUnavailableDialog";
import { DEMO_HALL_REVIEWS, findHallDetailsFallback } from "@/constants/hallDetailsFallback";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useT } from "@/i18n";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import { localizeHallDetails, localizePriceLabel } from "@/lib/localize-hall-display";
import { fetchHallComments, mapCommentToReview } from "@/services/comments";
import { fetchHallById } from "@/services/halls";
import type { HallDetails } from "@/types/hall";

type ViewStatus = "loading" | "ready" | "unavailable" | "error";

type HallDetailsViewProps = {
  hallId: string;
  onClose?: () => void;
};

function PopupGallery({ hallName, images }: { hallName: string; images: string[] }) {
  const t = useT();
  if (images.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-6 text-center text-sm text-[var(--wesal-muted)]"
        role="status"
        data-testid="hall-gallery-empty"
      >
        {t("halls.gallery.ownerEmpty")}
      </p>
    );
  }
  return <HallGallery hallName={hallName} images={images} />;
}

export default function HallDetailsView({ hallId, onClose }: HallDetailsViewProps) {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const { session, status: authStatus } = useAuth();
  const local = isDemoModeEnabled() ? findHallDetailsFallback(hallId) : undefined;
  const seeded = local ? { ...local, images: [] as string[] } : null;
  const [loadedId, setLoadedId] = useState(hallId);
  const [status, setStatus] = useState<ViewStatus>(seeded ? "ready" : "loading");
  const [hall, setHall] = useState<HallDetails | null>(seeded);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingBlockedOpen, setBookingBlockedOpen] = useState(false);
  const { canBook, isGuest, isOwnHall } = useHallPermissions(hall);

  if (loadedId !== hallId) {
    setLoadedId(hallId);
    setHall(seeded);
    setStatus(local ? "ready" : "loading");
    setMessage(null);
    setWarning(null);
  }

  useEffect(() => {
    if (authStatus !== "ready") return;

    let active = true;
    const cached = isDemoModeEnabled() ? findHallDetailsFallback(hallId) : undefined;

    void fetchHallById(hallId).then(async (result) => {
      if (!active) return;
      if (result.status === "ok") {
        setHall({
          ...result.hall,
          // Zero reviews stay zero: demo placeholder reviews only fill the gap
          // when demo mode is explicitly enabled.
          reviews:
            result.hall.reviews.length > 0
              ? result.hall.reviews
              : isDemoModeEnabled()
                ? DEMO_HALL_REVIEWS
                : [],
        });
        setWarning(result.warning ?? null);
        setStatus("ready");
        // A null result means the comments API was unreachable, so the placeholder
        // reviews stay; an empty list is authoritative and clears them.
        const comments = await fetchHallComments(hallId);
        if (!active || comments == null) return;
        setHall((current) =>
          current
            ? { ...current, reviews: comments.map(mapCommentToReview) }
            : current,
        );
        return;
      }
      if (cached) return;
      setHall(null);
      setMessage(result.message);
      setStatus(result.status === "unavailable" ? "unavailable" : "error");
    });

    return () => {
      active = false;
    };
  }, [hallId, reloadKey, authStatus, session.isAuthenticated]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const shell = (content: ReactNode) => (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center overscroll-none sm:items-center sm:p-4 md:p-6"
      data-testid="hall-details-overlay"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(60,40,35,0.28)]"
        aria-label={t("common.close")}
        onClick={close}
      />
      <div className="relative z-10 flex h-[100dvh] w-full min-h-0 max-w-6xl flex-col overflow-hidden sm:h-[min(92dvh,900px)]">
        {content}
      </div>
    </div>
  );

  if (status === "loading") {
    return shell(
      <div
        className="h-full animate-pulse overflow-hidden rounded-t-[1.75rem] bg-white p-4 shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:rounded-[1.75rem] sm:p-6"
        data-testid="hall-details-loading"
        aria-busy="true"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-[4/3] rounded-2xl bg-[var(--wesal-pink)]" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded bg-[rgba(193,123,127,0.2)]" />
            <div className="h-24 rounded-2xl bg-[var(--wesal-pink-soft)]" />
          </div>
        </div>
      </div>,
    );
  }

  if (status === "unavailable") {
    return shell(
      <div
        className="wesal-modal-scroll flex max-h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto rounded-t-[1.75rem] bg-white px-5 py-10 text-center shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:max-h-[92dvh] sm:rounded-[1.75rem] sm:px-6"
        data-testid="hall-unavailable-state"
        role="status"
      >
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f8e9ea] text-[#c62828]"
          aria-hidden="true"
        >
          <LockGlyph />
        </span>
        <h1 className="mt-3 text-xl font-extrabold text-[var(--wesal-text)] sm:text-2xl">
          {t("halls.details.unavailableTitle")}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--wesal-muted)]">
          {message ?? t("halls.details.unavailableDesc")}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" className="btn-primary !bg-[var(--wesal-maroon-dark)]" onClick={close}>
            {t("common.ok")}
          </button>
          <Link href="/halls" className="btn-outline">
            {t("common.backToHalls")}
          </Link>
        </div>
      </div>,
    );
  }

  if (status === "error" || !hall) {
    return shell(
      <StateCard
        testId="hall-error-state"
        title={t("halls.details.errorTitle")}
        description={message ?? t("halls.details.errorDesc")}
        onClose={close}
        closeLabel={t("common.close")}
        backLabel={t("common.backToHalls")}
      >
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="btn-primary"
        >
          {t("common.retry")}
        </button>
      </StateCard>,
    );
  }

  const viewHall = localizeHallDetails(hall, lang);
  const detailedAddress = viewHall.detailedAddress?.trim() ?? "";
  const featureLabels = ownerFeatureLabels(viewHall.features, viewHall.otherFeatures);
  const capacityLabel = viewHall.capacityMax
    ? t("common.peopleRange", { min: viewHall.capacity, max: viewHall.capacityMax })
    : t("common.peopleCount", { count: viewHall.capacity });

  return shell(
    <article
      className="wesal-modal-scroll relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:rounded-[1.75rem] lg:flex-row"
      data-testid="hall-details-ready"
    >
        <button
          type="button"
          onClick={close}
          className="absolute end-3 top-3 z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white shadow-md sm:end-4 sm:top-4 sm:h-11 sm:w-11"
          aria-label={t("common.close")}
          data-testid="hall-details-close"
        >
          <CloseIcon />
        </button>

        <div className="hidden h-full w-1/2 shrink-0 overflow-y-auto overscroll-contain bg-white p-6 lg:block">
          <div className="relative">
            {!viewHall.isAvailable ? (
              <HallLockedBadge
                variant="public"
                className="absolute start-3 top-3 z-10"
              />
            ) : null}
            <PopupGallery hallName={viewHall.name} images={viewHall.images} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-1/2 lg:min-w-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="shrink-0 bg-white px-3 pb-2 pt-3 sm:px-5 sm:pt-5 lg:hidden">
          <div className="relative">
            {!viewHall.isAvailable ? (
              <HallLockedBadge
                variant="public"
                className="absolute start-3 top-3 z-10"
              />
            ) : null}
            <PopupGallery hallName={viewHall.name} images={viewHall.images} />
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-6 lg:h-full lg:px-8 lg:pb-6 lg:pt-8">
          {warning ? (
            <p
              className="mb-4 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-2 text-xs text-[var(--wesal-text)]"
              role="status"
            >
              {warning}
            </p>
          ) : null}

          <header
            className="flex items-start justify-between gap-3"
            data-testid="hall-name-section"
          >
            <div className="min-w-0">
              <button
                type="button"
                className="block w-full text-start"
                data-testid="hall-popup-title-link"
                onClick={() => {
                  onClose?.();
                  router.push(buildHallDetailsPath(viewHall.id));
                }}
              >
                <h1 className="text-lg font-extrabold leading-8 break-words text-[var(--wesal-maroon)] underline-offset-4 hover:underline sm:text-[1.65rem]">
                  {viewHall.name}
                </h1>
              </button>
              <div className="mt-5 flex flex-nowrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex !h-10 !w-52 items-center rounded-full bg-[var(--wesal-maroon)] py-0.5 pe-1 ps-0.5 text-start text-white transition-colors hover:bg-[var(--wesal-maroon-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
                  data-testid="hall-popup-details-cta"
                  onClick={() => {
                    onClose?.();
                    router.push(buildHallDetailsPath(viewHall.id));
                  }}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)] ring-2 ring-white">
                    <DetailsIcon />
                  </span>
                  <span className="min-w-0 flex-1 px-2 text-center text-xs font-extrabold leading-tight">
                    {t("halls.popup.clickForDetails")}
                  </span>
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"
                    aria-hidden="true"
                  >
                    <ChevronIcon />
                  </span>
                </button>
                <AskMabroukAboutHallButton
                  hallId={viewHall.id}
                  hallName={viewHall.name}
                  variant="inline"
                  className="!h-10 !w-52"
                />
              </div>
            </div>
          </header>

          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="hall-location">
            <InfoCard
              icon={<PinIcon />}
              label={t("halls.details.location")}
              value={viewHall.location}
            />
            <InfoCard
              icon={<GuestsIcon />}
              label={t("halls.details.capacity")}
              value={capacityLabel}
            />
            {viewHall.priceLabel ? (
              <InfoCard
                icon={<PriceIcon />}
                label={t("halls.details.priceLabel")}
                value={
                  <PriceValue
                    label={
                      localizePriceLabel(viewHall.priceLabel, lang) ??
                      viewHall.priceLabel
                    }
                  />
                }
              />
            ) : null}
          </div>

          {detailedAddress ? (
            <section className="mt-7" data-testid="hall-main-info">
              <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
                {t("halls.details.tabs.address")}
              </h2>
              <p className="mt-2.5 text-[15px] font-medium leading-8 text-[#5c534e]">
                {detailedAddress}
              </p>
            </section>
          ) : null}

          {featureLabels.length > 0 ? (
            <section className="mt-7" data-testid="hall-popup-features">
              <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
                {t("halls.details.tabs.features")}
              </h2>
              <div className="mt-4">
                <HallAmenitiesGrid amenities={featureLabels} embedded />
              </div>
            </section>
          ) : null}

          <section className="mt-7">
            <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
              {t("halls.details.reviews")}
            </h2>
            {viewHall.rating != null ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-3xl font-extrabold leading-none text-[var(--wesal-maroon)]">
                  {Number(viewHall.rating).toFixed(1)}
                </p>
                <div>
                  <GoldStars rating={viewHall.rating} size={16} />
                  <p className="mt-1 text-sm text-[var(--wesal-muted)]">
                    {t("halls.details.basedOn", { count: viewHall.reviewCount ?? 0 })}
                  </p>
                </div>
              </div>
            ) : null}

            <HallCommentList
              comments={viewHall.reviews}
              onCommentUpdated={(review) => {
                setHall((current) =>
                  current
                    ? {
                        ...current,
                        reviews: current.reviews.map((item) =>
                          item.id === review.id ? { ...item, ...review } : item,
                        ),
                      }
                    : current,
                );
              }}
              onCommentDeleted={(commentId) => {
                setHall((current) =>
                  current
                    ? {
                        ...current,
                        reviews: current.reviews.filter((item) => item.id !== commentId),
                      }
                    : current,
                );
              }}
            />

            <HallAddReviewCard
              hallId={viewHall.id}
              isHallOwner={isOwnHall}
              onRated={({ averageRating, totalRatings }) => {
                setHall((current) =>
                  current
                    ? {
                        ...current,
                        rating: averageRating,
                        reviewCount: totalRatings,
                      }
                    : current,
                );
              }}
              onCommentSubmitted={(review) => {
                setHall((current) =>
                  current
                    ? { ...current, reviews: [review, ...current.reviews] }
                    : current,
                );
              }}
            />

          </section>

          {isOwnHall ? (
            <p
              className="mt-6 rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-start text-sm leading-7 text-[var(--wesal-muted)]"
              data-testid="hall-actions-owner"
              role="status"
            >
              {t("halls.details.ownerBanner")}
            </p>
          ) : null}
        </div>
        </div>

          {!isOwnHall && (isGuest || canBook) ? (
            <div
              className="shrink-0 border-t border-[var(--wesal-border)] bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8"
              data-testid="hall-actions"
            >
              {isGuest ? (
                <div className="flex gap-2 sm:gap-3">
                    <Link
                      href={`/login?redirect=/halls/${viewHall.id}&intent=book`}
                      className={`btn-outline min-w-0 flex-1 !min-h-11 !rounded-xl !px-2 !text-sm !font-bold sm:!min-h-12 sm:!text-[15px] ${
                        !viewHall.isAvailable ? "!opacity-50 pointer-events-none" : ""
                      }`}
                      aria-disabled={!viewHall.isAvailable || undefined}
                      tabIndex={!viewHall.isAvailable ? -1 : undefined}
                    >
                      {t("nav.login")}
                    </Link>
                    <Link
                      href={`/register?redirect=/halls/${viewHall.id}&intent=book`}
                      className={`btn-outline min-w-0 flex-1 !min-h-11 !rounded-xl !px-2 !text-sm !font-bold sm:!min-h-12 sm:!text-[15px] ${
                        !viewHall.isAvailable ? "!opacity-50 pointer-events-none" : ""
                      }`}
                      aria-disabled={!viewHall.isAvailable || undefined}
                      tabIndex={!viewHall.isAvailable ? -1 : undefined}
                    >
                      {t("nav.register")}
                    </Link>
                </div>
              ) : canBook ? (
                <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      className={`btn-primary min-w-0 flex-1 !min-h-11 !rounded-xl !px-2 !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:!min-h-12 sm:!text-[15px] ${
                        !viewHall.isAvailable ? "!opacity-50" : ""
                      }`}
                      data-testid="hall-book-button"
                      aria-disabled={!viewHall.isAvailable || undefined}
                      onClick={() => {
                        if (!viewHall.isAvailable) {
                          setBookingBlockedOpen(true);
                          return;
                        }
                        onClose?.();
                        router.push(buildHallDetailsPath(viewHall.id, true));
                      }}
                    >
                      {t("halls.details.bookNow")}
                    </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <HallUnavailableDialog
          open={bookingBlockedOpen}
          title={t("halls.booking.blockedTitle")}
          body={t("halls.booking.blockedBody")}
          onClose={() => setBookingBlockedOpen(false)}
          testId="hall-popup-booking-blocked-dialog"
        />
      </article>,
    );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[var(--wesal-maroon)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--wesal-maroon)]">{label}</p>
        <p className="break-words text-sm leading-5 text-[#5c534e]">{value}</p>
      </div>
    </div>
  );
}

function StateCard({
  title,
  description,
  children,
  testId,
  onClose,
  closeLabel,
  backLabel,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  testId: string;
  onClose: () => void;
  closeLabel: string;
  backLabel: string;
}) {
  return (
    <div
      className="wesal-modal-scroll max-h-[100dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white px-5 py-8 text-center shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:max-h-[92dvh] sm:rounded-[1.75rem] sm:px-6 sm:py-10"
      data-testid={testId}
      role="status"
    >
      <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">{description}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {children}
        <button type="button" className="btn-outline" onClick={onClose}>
          {closeLabel}
        </button>
        <Link href="/halls" className="btn-outline">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

function formatPriceLabel(label: string) {
  const withShekel = label.replace(/دولار/g, "₪");
  if (withShekel.includes("₪")) return withShekel;
  return withShekel.replace(/^([\d,.]+)\s*/, "$1 ₪ ");
}

function PriceValue({ label }: { label: string }) {
  const display = formatPriceLabel(label);
  const parts = display.split("₪");
  if (parts.length < 2) return display;
  return (
    <>
      {parts[0]}
      <span className='font-["Segoe_UI",Arial,sans-serif]'>₪</span>
      {parts.slice(1).join("₪")}
    </>
  );
}

function PriceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.2 12 4.7a2 2 0 0 1 1.4-.6H19.5v6.1a2 2 0 0 1-.6 1.4L11.3 19.2a2 2 0 0 1-2.8 0L4.5 15a2 2 0 0 1 0-2.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="16.2" cy="7.8" r="1.15" fill="currentColor" />
    </svg>
  );
}

function DetailsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 4.5h7.2L19 9.2V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5H7Z" strokeLinejoin="round" />
      <path d="M14 4.8V9h4.2M8.8 12.5h6.4M8.8 16h4.2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c.6-3 3-4.8 5.5-4.8S14 16 14.6 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15 14.5c2 .2 3.8 1.6 4.4 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ownerFeatureLabels(
  features: string[] | undefined,
  otherFeatures: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const label of features ?? []) {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    labels.push(trimmed);
  }
  const extra = otherFeatures?.trim();
  if (extra && !seen.has(extra)) labels.push(extra);
  return labels;
}
