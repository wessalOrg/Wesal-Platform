"use client";

import { useLayoutEffect } from "react";
import { useImagePreviewUrls } from "@/hooks/useImagePreviewUrls";

/** Uses the existing URL owner; allocating during render leaks under abandoned renders. */
export function useHallImagePreviews(files: readonly File[]) {
  const { previewUrls, replacePreviews } = useImagePreviewUrls();
  useLayoutEffect(() => { replacePreviews(files); }, [files, replacePreviews]);
  return files.flatMap((file, index) => previewUrls[index] ? [{
    key: `${file.name}-${file.size}-${file.lastModified}-${index}`, name: file.name, url: previewUrls[index],
  }] : []);
}
