"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Owns only locally selected File URLs, never persisted backend image references. */
export function useImagePreviewUrls() {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const allocated = useRef(new Map<string, File>());
  const requested = useRef<string[]>([]);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useLayoutEffect(() => {
    // DOM mutations have finished: removed URLs are no longer used by thumbnails or the hero.
    // A lower-priority selection may still be waiting for its React commit.
    const retained = new Set([...previewUrls, ...requested.current]);
    for (const url of allocated.current.keys()) {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url);
        allocated.current.delete(url);
      }
    }
  }, [previewUrls]);

  useEffect(() => {
    const resources = allocated.current;
    return () => {
      // Release after DOM removal. Effect replay/refresh may reactivate this same owner.
      queueMicrotask(() => {
        if (mounted.current) return;
        for (const url of resources.keys()) URL.revokeObjectURL(url);
        resources.clear();
      });
    };
  }, []);

  const replacePreviews = useCallback((files: readonly File[]) => {
    if (!mounted.current) return;
    const used = new Set<string>();
    const created: string[] = [];
    try {
      const next = files.map((file) => {
        const retained = [...allocated.current].find(([url, existing]) => existing === file && !used.has(url));
        const url = retained?.[0] ?? URL.createObjectURL(file);
        if (!retained) {
          allocated.current.set(url, file);
          created.push(url);
        }
        used.add(url);
        return url;
      });
      requested.current = next;
      setPreviewUrls(next);
    } catch (error) {
      // A partially failed allocation must not leak or disturb the currently visible previews.
      for (const url of created) {
        URL.revokeObjectURL(url);
        allocated.current.delete(url);
      }
      throw error;
    }
  }, []);

  return { previewUrls, replacePreviews };
}
