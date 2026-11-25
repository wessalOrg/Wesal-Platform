"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export type AnchoredPanelOptions = {
  /** Pixel width, or "anchor" to match the trigger width exactly. */
  width?: number | "anchor";
  /** Estimated panel height used to decide flip-up vs open-down. */
  estimateHeight?: number;
  /** Prefer opening above the trigger when there is room. */
  preferUp?: boolean;
  /**
   * Force vertical placement. `"down"` / `"up"` skip auto-flip;
   * `"auto"` (default) uses space + preferUp / estimateHeight.
   */
  placement?: "auto" | "down" | "up";
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
    placement = "auto",
    align = "start",
  } = options;
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    zIndex: 300,
    visibility: "hidden",
  });

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setStyle({ position: "fixed", zIndex: 300, visibility: "hidden" });
  }

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth =
        width === "anchor"
          ? Math.max(rect.width, 1)
          : Math.min(width, window.innerWidth - 16);

      // Prefer keeping the panel inside the viewport; bias toward the
      // content side when the anchor sits near a side rail / edge.
      let left = align === "end" ? rect.right - panelWidth : rect.left;
      const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;
      // If still overflowing the opposite edge (narrow screens), center on anchor.
      if (left + panelWidth > window.innerWidth - 8) {
        left = Math.max(8, Math.min(maxLeft, rect.left + rect.width / 2 - panelWidth / 2));
      }

      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp =
        placement === "up"
          ? true
          : placement === "down"
            ? false
            : preferUp
              ? spaceAbove >= Math.min(estimateHeight, spaceBelow) ||
                spaceAbove > spaceBelow
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

    // Layout measurement must finish before keyboard focus moves into the portal.
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width, estimateHeight, preferUp, placement, align]);

  return style;
}
