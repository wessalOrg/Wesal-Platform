"use client";

import { useLayoutEffect } from "react";
import { useImagePreviewUrls } from "@/hooks/useImagePreviewUrls";

/** The rendered preview owns its URL; retaining a retry File does not retain a URL. */
export function useChatAttachmentPreview(file: File | null | undefined) {
  const { previewUrls, replacePreviews } = useImagePreviewUrls();
  useLayoutEffect(() => {
    replacePreviews(file ? [file] : []);
  }, [file, replacePreviews]);
  return file ? previewUrls[0] ?? null : null;
}
