"use client";

import { useState } from "react";
import Image from "next/image";

export function isRemoteImage(src: string) {
  return /^https?:\/\//i.test(src);
}

function canOptimizeRemote(src: string) {
  try {
    const host = new URL(src).hostname;
    return (
      host === "images.unsplash.com" ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

export default function HallMedia({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <span
        className={`flex items-center justify-center bg-[#f3ece8] text-xs text-[var(--wesal-muted)] ${className ?? ""}`}
        role="img"
        aria-label={alt || "تعذر تحميل الصورة"}
      >
        تعذر تحميل الصورة
      </span>
    );
  }

  if (isRemoteImage(src) && !canOptimizeRemote(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      quality={75}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
