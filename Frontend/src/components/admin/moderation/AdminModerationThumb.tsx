"use client";

import { useEffect, useState } from "react";
import { fetchAdminModerationImageBlob } from "@/services/admin-moderation";

type AdminModerationThumbProps = {
  imagePath: string | null | undefined;
  alt?: string;
  className?: string;
};

/** Loads auth-protected moderation image URLs as blob previews. */
export default function AdminModerationThumb({
  imagePath,
  alt = "",
  className = "h-14 w-20 rounded-xl object-cover",
}: AdminModerationThumbProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const path = imagePath?.trim();
    if (!path) {
      setSrc(null);
      return;
    }

    void fetchAdminModerationImageBlob(path)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] text-[0.65rem] font-bold text-[var(--wesal-maroon)] ${className}`}
        aria-hidden="true"
      >
        —
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
