"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const PLACEHOLDER = "/halls/featured-lotus.webp";

export function isRemoteImage(src: string) {
  return /^https?:\/\//i.test(src);
}

type HallImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  onError?: () => void;
};

export default function HallImage({
  src,
  alt,
  className,
  sizes,
  fill = false,
  priority = false,
  onError,
}: HallImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = failed || !src?.trim() ? PLACEHOLDER : src.trim();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const handleError = () => {
    if (!failed) {
      setFailed(true);
      onError?.();
    }
  };

  if (isRemoteImage(resolved) && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt}
        className={
          fill
            ? `absolute inset-0 h-full w-full object-cover ${className ?? ""}`
            : className
        }
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={(event) => {
          if (event.currentTarget.src !== PLACEHOLDER) {
            event.currentTarget.src = PLACEHOLDER;
          }
          handleError();
        }}
      />
    );
  }

  return (
    <Image
      src={failed ? PLACEHOLDER : resolved}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      quality={75}
      priority={priority}
      onError={handleError}
    />
  );
}

export { PLACEHOLDER as HALL_IMAGE_PLACEHOLDER };
