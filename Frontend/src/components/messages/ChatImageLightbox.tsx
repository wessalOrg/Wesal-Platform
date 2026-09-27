"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

type ChatImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export default function ChatImageLightbox({ src, alt, onClose }: ChatImageLightboxProps) {
  const t = useT();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("messages.imageLightbox")}
      data-testid="chat-image-lightbox"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- blob / uploaded receipt */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 max-h-[90svh] max-w-full rounded-xl object-contain shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
      />
    </div>
  );
}
