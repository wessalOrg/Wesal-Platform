"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

type DepositConfirmedModalProps = {
  requesterName: string | null;
  onClose: () => void;
};

export default function DepositConfirmedModal({
  requesterName,
  onClose,
}: DepositConfirmedModalProps) {
  const t = useT();
  const open = Boolean(requesterName?.trim());

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!requesterName?.trim()) return null;

  return (
    <div className="fixed inset-0 z-[260]" role="presentation" data-testid="deposit-confirmed-modal">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-confirmed-title"
        className="absolute inset-x-4 top-1/2 mx-auto w-auto max-w-[24rem] -translate-y-1/2 rounded-[28px] bg-white px-5 pb-5 pt-6 shadow-[0_24px_60px_rgba(60,35,30,0.22)] sm:px-6 sm:pb-6"
      >
        <h2
          id="deposit-confirmed-title"
          className="text-center text-xl font-extrabold leading-snug text-[var(--wesal-maroon)]"
        >
          {t("owner.notifications.depositConfirmedTitle")}
        </h2>
        <p className="mt-3 text-center text-sm leading-7 text-[var(--wesal-text)]">
          {t("owner.notifications.depositConfirmedBody", { name: requesterName.trim() })}
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
