"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GoldStar, GoldStars } from "@/components/ui/GoldStar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import HallBookingPanel from "@/components/halls/HallBookingPanel";
import HallContactButton from "@/components/halls/HallContactButton";
import HallGallery from "@/components/halls/HallGallery";
import HallCommentList from "@/components/halls/HallCommentList";
import HallCommentPanel from "@/components/halls/HallCommentPanel";
import HallGuestFeedbackPrompt from "@/components/halls/HallGuestFeedbackPrompt";
import HallRatingPanel from "@/components/halls/HallRatingPanel";
import { DEMO_HALL_REVIEWS, findHallDetailsFallback } from "@/constants/hallDetailsFallback";
import { fetchHallComments, mapCommentToReview } from "@/services/comments";
import { fetchHallById } from "@/services/halls";
import type { BookingSelection, HallAmenity, HallDetails } from "@/types/hall";

type ViewStatus = "loading" | "ready" | "unavailable" | "error";

type HallDetailsViewProps = {
  hallId: string;
  onClose?: () => void;
};

export default function HallDetailsView({ hallId, onClose }: HallDetailsViewProps) {
  const router = useRouter();
  const { session, status: authStatus } = useAuth();
  const authReady = authStatus === "ready";
  const isGuest = authReady && !session.isAuthenticated;
  const canBook = authReady && session.isAuthenticated;
  const local = findHallDetailsFallback(hallId);
  const [loadedId, setLoadedId] = useState(hallId);
  const [status, setStatus] = useState<ViewStatus>(local ? "ready" : "loading");
  const [hall, setHall] = useState<HallDetails | null>(local ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSelection, setBookingSelection] = useState<BookingSelection | null>(
    null,
  );

  if (loadedId !== hallId) {
    setLoadedId(hallId);
    setHall(local ?? null);
    setStatus(local ? "ready" : "loading");
    setMessage(null);
    setWarning(null);
  }

  useEffect(() => {
    let active = true;
    const cached = findHallDetailsFallback(hallId);

    void fetchHallById(hallId).then(async (result) => {
      if (!active) return;
      if (result.status === "ok") {
        setHall({
          ...result.hall,
          reviews:
            result.hall.reviews.length > 0
              ? result.hall.reviews
              : DEMO_HALL_REVIEWS,
        });
        setWarning(result.warning ?? null);
        setStatus("ready");
        const comments = await fetchHallComments(hallId);
        if (!active || comments == null) return;
        if (comments.length === 0) return;
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
  }, [hallId, reloadKey]);

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
        aria-label="إغلاق"
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
      <StateCard
        testId="hall-unavailable-state"
        title="القاعة غير متاحة"
        description={
          message ??
          "هذه القاعة غير متاحة للعرض أو التواصل حالياً (مقفلة، قيد المراجعة، مرفوضة، أو محذوفة)."
        }
        onClose={close}
      />,
    );
  }

  if (status === "error" || !hall) {
    return shell(
      <StateCard
        testId="hall-error-state"
        title="تعذر تحميل التفاصيل"
        description={message ?? "حدث خطأ أثناء جلب بيانات القاعة."}
        onClose={close}
      >
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="btn-primary"
        >
          إعادة المحاولة
        </button>
      </StateCard>,
    );
  }

  const capacityLabel = hall.capacityMax
    ? `${hall.capacity}-${hall.capacityMax} شخص`
    : `${hall.capacity} شخص`;

  return shell(
    <article
      className="wesal-modal-scroll relative flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-white shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:rounded-[1.75rem] lg:flex-row lg:overflow-hidden"
      data-testid="hall-details-ready"
    >
        <button
          type="button"
          onClick={close}
          className="sticky top-3 z-20 me-3 ms-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white shadow-md sm:h-11 sm:w-11 lg:absolute lg:end-4 lg:top-4 lg:me-0 lg:ms-0"
          aria-label="إغلاق"
          data-testid="hall-details-close"
        >
          <CloseIcon />
        </button>

        <div className="shrink-0 bg-white px-3 pb-2 pt-3 sm:px-5 sm:pt-5 lg:h-full lg:w-1/2 lg:overflow-y-auto lg:p-6">
          <HallGallery hallName={hall.name} images={hall.images} />
        </div>

        <div className="min-h-0 flex-none px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:w-1/2 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:p-8">
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
              <h1 className="text-lg font-extrabold leading-8 break-words text-[var(--wesal-maroon)] sm:text-[1.65rem]">
                {hall.name}
              </h1>
              {hall.priceLabel ? <PriceLine label={hall.priceLabel} /> : null}
            </div>
            {hall.rating != null ? (
              <p className="mt-1 inline-flex shrink-0 items-center gap-1 text-[15px] font-semibold text-[var(--wesal-maroon)]">
                <GoldStar size={16} />
                {Number(hall.rating).toFixed(1)}
              </p>
            ) : null}
          </header>

          <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2" data-testid="hall-location">
            <InfoCard
              icon={<PinIcon />}
              label="الموقع"
              value={hall.location}
            />
            <InfoCard
              icon={<GuestsIcon />}
              label="السعة"
              value={capacityLabel}
            />
          </div>

          {hall.description ? (
            <section className="mt-7" data-testid="hall-main-info">
              <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
                وصف القاعة
              </h2>
              <p className="mt-2.5 text-[15px] font-medium leading-8 text-[#5c534e]">
                {hall.description}
              </p>
            </section>
          ) : null}

          {hall.amenities.length > 0 ? (
            <section className="mt-7">
              <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
                المرافق والخدمات
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 min-[400px]:grid-cols-2">
                {hall.amenities.map((amenity) => (
                  <li
                    key={amenity.id}
                    className="flex min-w-0 items-center gap-2 text-[15px] font-medium leading-8 text-[#5c534e]"
                  >
                    <span className="shrink-0 text-[var(--wesal-maroon)]">
                      <AmenityIcon icon={amenity.icon} />
                    </span>
                    {amenity.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!hall.isOwner && canBook ? (
            <HallBookingPanel
              open={bookingOpen}
              hallName={hall.name}
              days={hall.availabilityDays ?? []}
              selection={bookingSelection}
              onSelect={setBookingSelection}
              onClose={() => setBookingOpen(false)}
              onConfirm={() => {
                if (!bookingSelection) return;
                setBookingOpen(false);
              }}
            />
          ) : null}

          <section className="mt-7">
            <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">
              تقييمات العملاء
            </h2>
            {hall.rating != null ? (
              <div className="mt-4 flex items-center justify-center gap-5 rounded-2xl bg-[#f7f1ec] px-4 py-5 shadow-[0_12px_30px_rgba(110,60,55,0.12)] sm:gap-8 sm:px-8 sm:py-6">
                <p className="text-4xl font-extrabold leading-none text-[var(--wesal-maroon)] sm:text-5xl lg:text-6xl">
                  {Number(hall.rating).toFixed(1)}
                </p>
                <div className="flex flex-col items-center">
                  <GoldStars rating={hall.rating} size={18} />
                  <p className="mt-1.5 text-center text-sm text-[var(--wesal-maroon)]">
                    بناءً على {hall.reviewCount ?? 0} تقييم
                  </p>
                </div>
              </div>
            ) : null}

            <HallRatingPanel
              hallId={hall.id}
              isHallOwner={Boolean(hall.isOwner)}
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
            />

            <HallCommentPanel
              hallId={hall.id}
              isHallOwner={Boolean(hall.isOwner)}
              onSubmitted={(review) => {
                setHall((current) =>
                  current
                    ? { ...current, reviews: [review, ...current.reviews] }
                    : current,
                );
              }}
            />

            <HallCommentList comments={hall.reviews} />

            <HallGuestFeedbackPrompt
              hallId={hall.id}
              isHallOwner={Boolean(hall.isOwner)}
            />
          </section>

          {hall.isOwner ? (
            <p
              className="mt-6 rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-start text-sm leading-7 text-[var(--wesal-muted)]"
              data-testid="hall-actions-owner"
              role="status"
            >
              أنت مالك هذه القاعة — لا يظهر زر التواصل أو الحجز على قاعتك.
            </p>
          ) : !hall.isAvailable ? (
            <p
              className="mt-6 rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-start text-sm leading-7 text-[var(--wesal-muted)]"
              data-testid="hall-actions-unavailable"
              role="status"
            >
              هذه القاعة غير متاحة أو مقفلة حالياً، لذلك تم إيقاف التواصل والحجز.
            </p>
          ) : (
            <div
              className="sticky bottom-0 mt-5 bg-gradient-to-t from-white from-65% to-transparent pb-1 pt-4"
              data-testid="hall-actions"
              dir="rtl"
            >
              <div className="flex gap-2 sm:gap-3">
                <HallContactButton
                  hallId={hall.id}
                  isOwnHall={false}
                  isAvailable={hall.isAvailable}
                  onOpened={onClose}
                />
                {isGuest ? (
                  <Link
                    href={`/register?redirect=/halls/${hall.id}&intent=book`}
                    className="btn-primary min-w-0 flex-1 !min-h-11 !rounded-xl !px-2 !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:!min-h-12 sm:!text-[15px]"
                    data-testid="hall-book-button"
                  >
                    احجز الآن
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary min-w-0 flex-1 !min-h-11 !rounded-xl !px-2 !text-sm !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b] sm:!min-h-12 sm:!text-[15px]"
                    data-testid="hall-book-button"
                    disabled={!canBook}
                    onClick={() => {
                      setBookingSelection(null);
                      setBookingOpen(true);
                    }}
                  >
                    {canBook ? "احجز الآن" : "…"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
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
  value: string;
}) {
  return (
    <div className="group flex min-w-0 cursor-default items-center gap-3 rounded-2xl bg-[#f4eee9] px-3 py-3.5 shadow-[0_6px_18px_rgba(90,55,45,0.07)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f8f3ef] hover:shadow-[0_14px_28px_rgba(90,55,45,0.14)] active:translate-y-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white transition duration-200 group-hover:scale-105 group-hover:bg-[var(--wesal-maroon-dark)] group-hover:shadow-[0_6px_14px_rgba(193,123,127,0.4)] sm:h-11 sm:w-11">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-[var(--wesal-maroon)]">{label}</p>
        <p className="break-words text-[12px] leading-5 text-[#8a7a70] sm:text-[13px]">{value}</p>
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
}: {
  title: string;
  description: string;
  children?: ReactNode;
  testId: string;
  onClose: () => void;
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
          إغلاق
        </button>
        <Link href="/halls" className="btn-outline">
          العودة إلى القاعات
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

function PriceLine({ label }: { label: string }) {
  const display = formatPriceLabel(label);
  const match = display.match(/^([\d,.]+)\s*(.*)$/);
  if (!match) {
    return <p className="mt-1 text-[15px] text-[var(--wesal-maroon)]">{display}</p>;
  }
  return (
    <p className="mt-1 text-[var(--wesal-maroon)]">
      <span className="text-xl font-bold">{match[1]}</span>
      {match[2] ? (
        <span className="text-[15px] font-medium"> {match[2]}</span>
      ) : null}
    </p>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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

function AmenityIcon({ icon }: { icon: HallAmenity["icon"] }) {
  if (icon === "ac") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3v18M4.8 7.2l14.4 9.6M19.2 7.2 4.8 16.8M3 12h18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M12 7.2 9.6 5.4M12 7.2l2.4-1.8M12 16.8 9.6 18.6M12 16.8l2.4 1.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "sound") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="8" y="4" width="8" height="16" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="15" r="2.1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 7h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "parking") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3.5" width="16" height="17" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M9 17V7h4.1a3.2 3.2 0 0 1 0 6.4H9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.2h16l-8 3.2L4 8.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 11.4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M7.2 8.2C7.2 6 9.2 4.4 12 4.4s4.8 1.6 4.8 3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
