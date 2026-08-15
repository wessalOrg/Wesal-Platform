"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import HallActionCard from "@/components/halls/HallActionCard";
import HallAmenitiesGrid from "@/components/halls/HallAmenitiesGrid";
import HallBookingPanel from "@/components/halls/HallBookingPanel";
import HallDetailsError from "@/components/halls/HallDetailsError";
import HallDetailsSkeleton from "@/components/halls/HallDetailsSkeleton";
import HallGalleryContainer from "@/components/halls/HallGalleryContainer";
import HallHeader from "@/components/halls/HallHeader";
import HallUnavailableBanner from "@/components/halls/HallUnavailableBanner";
import { useAuth } from "@/hooks/useAuth";
import { useBookButtonBehavior } from "@/hooks/useBookButtonBehavior";
import { useHallDetails } from "@/hooks/useHallDetails";
import { buildHallDetailsPath, hasBookingIntent } from "@/lib/booking-intent";
import { saveBookingHallContext } from "@/lib/auth-storage";
import { resetBodyScrollLock } from "@/lib/body-scroll-lock";
import type { BookingSelection } from "@/types/hall";

type HallDetailsPageProps = {
  hallId: string;
};

export default function HallDetailsPage({ hallId }: HallDetailsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hydrated } = useAuth();
  const { state, hall, unavailable, usingFallback, errorMessage, retry } =
    useHallDetails(hallId);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSelection, setBookingSelection] = useState<BookingSelection | null>(
    null,
  );
  const bookIntentHandled = useRef(false);

  const shouldOpenBooking = hasBookingIntent(searchParams);

  useEffect(() => {
    return () => resetBodyScrollLock();
  }, []);

  useEffect(() => {
    bookIntentHandled.current = false;
  }, [hallId]);

  const openBookingFlow = useCallback(() => {
    setBookingSelection(null);
    setBookingOpen(true);
  }, []);

  const { handleBook, loginHref, registerHref } = useBookButtonBehavior({
    hallId,
    hydrated,
    isAuthenticated,
    unavailable,
    onOpenBooking: openBookingFlow,
  });

  const preserveGuestBookingContext = useCallback(() => {
    saveBookingHallContext(hallId);
  }, [hallId]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !shouldOpenBooking || bookIntentHandled.current) {
      return;
    }
    if (state.phase !== "ready" || unavailable || !hall) return;

    bookIntentHandled.current = true;
    openBookingFlow();
    router.replace(buildHallDetailsPath(hallId), { scroll: false });
  }, [
    hydrated,
    isAuthenticated,
    shouldOpenBooking,
    state.phase,
    unavailable,
    hall,
    openBookingFlow,
    hallId,
    router,
  ]);

  const handleBookingConfirm = useCallback(() => {
    if (!bookingSelection) return;
    setBookingOpen(false);
  }, [bookingSelection]);

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
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  if (state.phase === "ready" && state.result.status === "not_found") {
    return (
      <HallDetailsError
        message="لم يتم العثور على القاعة المطلوبة."
        onRetry={retry}
      />
    );
  }

  if (!hall) {
    return (
      <HallDetailsError
        message="حدث خطأ غير متوقع أثناء تحميل البيانات."
        onRetry={retry}
      />
    );
  }

  const isGuest = hydrated && !isAuthenticated;

  return (
    <div className="hall-details-page min-w-0 space-y-6 pb-10 sm:space-y-8 sm:pb-14">
      {usingFallback ? (
        <div
          className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-center sm:text-start"
          role="status"
          data-testid="hall-details-fallback-notice"
        >
          <p className="text-sm text-[var(--wesal-text)]">
            تعذر الاتصال بالخادم حاليًا. يتم عرض بيانات تجريبية.
            {errorMessage ? ` (${errorMessage})` : ""}
          </p>
          <button type="button" onClick={retry} className="btn-outline mt-3">
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {unavailable ? <HallUnavailableBanner hallName={hall.name} /> : null}

      <HallGalleryContainer images={hall.gallery} hallName={hall.name} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] lg:items-start lg:gap-8">
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <HallHeader hall={hall} />

          <section aria-labelledby="hall-description-heading">
            <h2
              id="hall-description-heading"
              className="text-lg font-bold text-[var(--wesal-maroon)] sm:text-xl"
            >
              عن القاعة
            </h2>
            <p className="mt-3 text-sm leading-8 text-[var(--wesal-text)] sm:text-base">
              {hall.description}
            </p>
          </section>

          <HallAmenitiesGrid amenities={hall.amenities} />

          {isGuest && !unavailable ? (
            <section
              className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-5"
              data-testid="hall-guest-booking-notice"
              aria-live="polite"
            >
              <p className="text-sm leading-7 text-[var(--wesal-text)]">
                أنشئ حساباً أو سجّل الدخول لاختيار تاريخ الحجز والفترة. عند الضغط على
                «اضغط للحجز» سيتم توجيهك لصفحة التسجيل مع حفظ هذه القاعة.
              </p>
            </section>
          ) : null}
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-[4.75rem] lg:z-[1] lg:self-start">
          <HallActionCard
            slotPrices={hall.slotPrices}
            ownerPhone={hall.ownerPhone}
            onBook={handleBook}
            disabled={unavailable}
            bookPending={!hydrated}
            isGuest={isGuest}
            loginHref={loginHref}
            registerHref={registerHref}
            onGuestAuthNavigate={preserveGuestBookingContext}
          />
        </div>
      </div>

      {hydrated && isAuthenticated && !unavailable ? (
        <HallBookingPanel
          open={bookingOpen}
          hallName={hall.name}
          days={hall.availabilityDays ?? []}
          selection={bookingSelection}
          onSelect={setBookingSelection}
          onClose={() => setBookingOpen(false)}
          onConfirm={handleBookingConfirm}
        />
      ) : null}
    </div>
  );
}
