"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAuthenticatedMediaBlob,
  isAuthenticatedMediaPath,
} from "@/services/authenticated-media";
import { resolveMediaUrl } from "@/lib/hall-media-url";

type AuthenticatedApiImageProps = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Shown while loading or when the image cannot be resolved. */
  fallback?: ReactNode;
  loading?: "lazy" | "eager";
};

/**
 * Renders API-gated media (`/api/v1/offers|posts/.../images/...`) via an
 * authenticated blob fetch. Public `/uploads` (and similar) URLs stay as
 * normal `<img src>`.
 */
export default function AuthenticatedApiImage({
  src,
  alt = "",
  className,
  fallback = null,
  loading = "lazy",
}: AuthenticatedApiImageProps) {
  const resolved = resolveMediaUrl(src);
  const needsAuth = isAuthenticatedMediaPath(resolved || src);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [trackedPath, setTrackedPath] = useState(resolved);

  if (trackedPath !== resolved) {
    setTrackedPath(resolved);
    setBlobSrc(null);
    setFailed(false);
  }

  useEffect(() => {
    if (!needsAuth || !resolved) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void fetchAuthenticatedMediaBlob(resolved)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setFailed(true);
          setBlobSrc(null);
          return;
        }
        objectUrl = url;
        setBlobSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setBlobSrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsAuth, resolved]);

  if (!resolved) return <>{fallback}</>;

  if (!needsAuth) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolved} alt={alt} className={className} loading={loading} />
    );
  }

  if (!blobSrc || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={blobSrc} alt={alt} className={className} loading={loading} />
  );
}
