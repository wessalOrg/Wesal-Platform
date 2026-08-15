"use client";

import Link from "next/link";
import type { HallSlotPrice } from "@/types/hall";

type HallActionCardProps = {
  slotPrices: HallSlotPrice[];
  ownerPhone?: string | null;
  onBook: () => void;
  disabled?: boolean;
  bookPending?: boolean;
  isGuest?: boolean;
  loginHref?: string;
  registerHref?: string;
  onGuestAuthNavigate?: () => void;
};

export default function HallActionCard({
  slotPrices,
  ownerPhone,
  onBook,
  disabled = false,
  bookPending = false,
  isGuest = false,
  loginHref = "/login",
  registerHref = "/register",
  onGuestAuthNavigate,
}: HallActionCardProps) {
  return (
    <aside
      className="hall-action-card w-full rounded-2xl border border-[var(--wesal-border)] bg-white p-5 shadow-[0_14px_40px_rgba(90,55,45,0.1)]"
      data-testid="hall-action-card"
    >
      <h2 className="text-base font-bold text-[var(--wesal-text)]">أسعار الفترات</h2>

      <ul className="mt-4 space-y-3">
        {slotPrices.length ? (
          slotPrices.map((slot) => (
            <li
              key={slot.label}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--wesal-text)]">{slot.label}</p>
                {slot.time ? (
                  <p className="mt-0.5 text-xs text-[var(--wesal-muted)]">{slot.time}</p>
                ) : null}
              </div>
              <span className="hall-price-badge shrink-0 text-xs">
                {slot.priceLabel ??
                  (slot.price != null ? `${slot.price.toLocaleString("en-US")} ₪` : "—")}
              </span>
            </li>
          ))
        ) : (
          <li className="rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3 text-sm text-[var(--wesal-muted)]">
            الأسعار غير متاحة حالياً.
          </li>
        )}
      </ul>

      {isGuest ? (
        <p className="mt-4 text-xs leading-6 text-[var(--wesal-muted)]">
          سجّل الدخول أو أنشئ حساباً لاختيار التاريخ والفترة.
        </p>
      ) : null}

      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={onBook}
          disabled={disabled || bookPending}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="hall-book-button"
        >
          {bookPending ? "جاري التحقق..." : "اضغط للحجز"}
        </button>

        {isGuest ? (
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={loginHref}
              onClick={onGuestAuthNavigate}
              className="btn-outline w-full text-center text-xs sm:text-sm"
            >
              تسجيل الدخول
            </Link>
            <Link
              href={registerHref}
              onClick={onGuestAuthNavigate}
              className="btn-outline w-full text-center text-xs sm:text-sm"
            >
              إنشاء حساب
            </Link>
          </div>
        ) : null}

        {ownerPhone ? (
          <a
            href={`tel:${ownerPhone.replace(/\s+/g, "")}`}
            className="btn-outline w-full"
            data-testid="hall-contact-owner"
          >
            تواصل مع صاحب الصالة
          </a>
        ) : (
          <button type="button" className="btn-outline w-full" disabled>
            تواصل مع صاحب الصالة
          </button>
        )}
      </div>
    </aside>
  );
}
