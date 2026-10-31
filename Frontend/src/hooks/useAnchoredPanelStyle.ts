"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export type AnchoredPanelOptions = {
  /** Pixel width, or "anchor" to match the trigger width exactly. */
  width?: number | "anchor";
  /** Estimated panel height used to decide flip-up vs open-down. */
  estimateHeight?: number;
  /** Prefer opening above the trigger when there is room. */
  preferUp?: boolean;
  /** Horizontal alignment relative to the trigger. */
  align?: "start" | "end";
};

/**
 * Positions a floating panel with `position: fixed` flush under (or above) an
 * anchor. Pair with a body portal (`AnchoredPanel`) so transformed modals do
 * not offset the coordinates.
 */
export function useAnchoredPanelStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: AnchoredPanelOptions = {},
): CSSProperties {
  const {
    width = "anchor",
    estimateHeight = 320,
    preferUp = false,
    align = "start",
  } = options;
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    zIndex: 300,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    if (!open) {
      setStyle({
        position: "fixed",
        zIndex: 300,
        visibility: "hidden",
      });
      return;
    }

    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth =
        width === "anchor"
          ? Math.max(rect.width, 1)
          : Math.min(width, window.innerWidth - 16);

      let left = align === "end" ? rect.right - panelWidth : rect.left;
      if (left + panelWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - panelWidth - 8);
      }
      if (left < 8) left = 8;

      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = preferUp
        ? spaceAbove >= Math.min(estimateHeight, spaceBelow) || spaceAbove > spaceBelow
        : spaceBelow < estimateHeight && spaceAbove > spaceBelow;

      setStyle({
        position: "fixed",
        zIndex: 300,
        visibility: "visible",
        boxSizing: "border-box",
        width: panelWidth,
        left,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.max(
          10 * 16,
          openUp ? rect.top - 16 : window.innerHeight - rect.bottom - 16,
        ),
        overflowY: "auto",
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width, estimateHeight, preferUp, align]);

  return style;
}
