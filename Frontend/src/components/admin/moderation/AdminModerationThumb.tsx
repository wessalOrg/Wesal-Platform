"use client";

import Image from "next/image";
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
  const path = imagePath?.trim() ?? "";
  const [result, setResult] = useState<{ path: string; src: string | null } | null>(null);
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setResult(null);
  }
  const src = result?.path === path ? result.src : null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!path) return;

    void fetchAdminModerationImageBlob(path)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setResult({ path, src: url });
      })
      .catch(() => {
        if (!cancelled) setResult({ path, src: null });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

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

  return <Image src={src} alt={alt} width={80} height={56} unoptimized loading="eager" className={className} />;
}
