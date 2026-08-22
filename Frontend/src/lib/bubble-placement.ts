import { FAB_VIEWPORT_MARGIN_PX } from "@/lib/fab-position";

/** Breathing room between the anchor and the bubble, where the tail sits. */
export const BUBBLE_GAP_PX = 12;
/** Keeps the tail from sliding past the bubble's rounded corners. */
export const BUBBLE_TAIL_INSET_PX = 18;

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Which face of the anchor the bubble sits on; drives the tail's edge. */
export type BubbleSide = "left" | "right" | "above" | "below";

export type BubblePlacement = {
  left: number;
  top: number;
  side: BubbleSide;
  /** Distance from the bubble's start edge to the anchor's centre, along the tail's axis. */
  tailOffset: number;
};

export type PlaceBubbleInput = {
  anchor: Rect;
  bubble: Size;
  viewport: Size;
  /** Screen areas the bubble must not cover, e.g. the sticky navigation bar. */
  avoid?: Rect[];
  margin?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isMeasured(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

/**
 * Picks where a bubble should sit relative to a freely positioned anchor.
 *
 * Sides are tried in order of the room actually available, so the bubble opens
 * away from the nearest edge instead of following a hardcoded direction — which
 * is what makes it correct in both RTL and LTR, and after the user drags the
 * anchor anywhere on screen. A side is skipped when the bubble would not fit on
 * it, or when it would cover an area the caller marked as critical.
 *
 * Returns `null` when no side works, so the caller can skip the invitation
 * rather than disrupt the user. Coordinates are always inside the viewport.
 */
export function placeBubble({
  anchor,
  bubble,
  viewport,
  avoid = [],
  margin = FAB_VIEWPORT_MARGIN_PX,
}: PlaceBubbleInput): BubblePlacement | null {
  // An unmeasurable anchor or bubble would produce NaN coordinates, and a NaN
  // offset silently drops the bubble at the top-left corner of the screen.
  if (
    !isMeasured(
      anchor.left,
      anchor.top,
      anchor.width,
      anchor.height,
      bubble.width,
      bubble.height,
      viewport.width,
      viewport.height,
      margin,
    )
  ) {
    return null;
  }

  const minLeft = margin;
  const maxLeft = viewport.width - margin - bubble.width;
  const minTop = margin;
  const maxTop = viewport.height - margin - bubble.height;

  // The bubble is larger than the viewport allows: there is no honest spot for it.
  if (maxLeft < minLeft || maxTop < minTop) return null;

  const centreX = anchor.left + anchor.width / 2;
  const centreY = anchor.top + anchor.height / 2;
  const roomLeft = anchor.left;
  const roomRight = viewport.width - (anchor.left + anchor.width);

  const sides: BubbleSide[] =
    roomRight >= roomLeft
      ? ["right", "left", "above", "below"]
      : ["left", "right", "above", "below"];

  for (const side of sides) {
    let left: number;
    let top: number;

    if (side === "left" || side === "right") {
      const wanted =
        side === "left"
          ? anchor.left - BUBBLE_GAP_PX - bubble.width
          : anchor.left + anchor.width + BUBBLE_GAP_PX;

      // Only the main axis decides whether a side fits; the cross axis may slide.
      if (wanted < minLeft || wanted > maxLeft) continue;
      left = wanted;
      top = clamp(centreY - bubble.height / 2, minTop, maxTop);
    } else {
      const wanted =
        side === "above"
          ? anchor.top - BUBBLE_GAP_PX - bubble.height
          : anchor.top + anchor.height + BUBBLE_GAP_PX;

      if (wanted < minTop || wanted > maxTop) continue;
      top = wanted;
      left = clamp(centreX - bubble.width / 2, minLeft, maxLeft);
    }

    const rect: Rect = { left, top, width: bubble.width, height: bubble.height };
    if (avoid.some((zone) => intersects(rect, zone))) continue;

    return { left, top, side, tailOffset: tailFor(side, left, top, centreX, centreY, bubble) };
  }

  // Near an edge the preferred gap may not fit, but a clamped seat still can —
  // as long as it stays in the viewport and does not cover the button or chrome.
  const paddedAnchor: Rect = {
    left: anchor.left - BUBBLE_GAP_PX / 2,
    top: anchor.top - BUBBLE_GAP_PX / 2,
    width: anchor.width + BUBBLE_GAP_PX,
    height: anchor.height + BUBBLE_GAP_PX,
  };

  for (const side of sides) {
    let left: number;
    let top: number;

    if (side === "left" || side === "right") {
      const wanted =
        side === "left"
          ? anchor.left - BUBBLE_GAP_PX - bubble.width
          : anchor.left + anchor.width + BUBBLE_GAP_PX;
      left = clamp(wanted, minLeft, maxLeft);
      top = clamp(centreY - bubble.height / 2, minTop, maxTop);
    } else {
      const wanted =
        side === "above"
          ? anchor.top - BUBBLE_GAP_PX - bubble.height
          : anchor.top + anchor.height + BUBBLE_GAP_PX;
      top = clamp(wanted, minTop, maxTop);
      left = clamp(centreX - bubble.width / 2, minLeft, maxLeft);
    }

    const rect: Rect = { left, top, width: bubble.width, height: bubble.height };
    if (intersects(rect, paddedAnchor)) continue;
    if (avoid.some((zone) => intersects(rect, zone))) continue;

    return { left, top, side, tailOffset: tailFor(side, left, top, centreX, centreY, bubble) };
  }

  return null;
}

function tailFor(
  side: BubbleSide,
  left: number,
  top: number,
  centreX: number,
  centreY: number,
  bubble: Size,
): number {
  return side === "left" || side === "right"
    ? clamp(
        centreY - top,
        BUBBLE_TAIL_INSET_PX,
        Math.max(BUBBLE_TAIL_INSET_PX, bubble.height - BUBBLE_TAIL_INSET_PX),
      )
    : clamp(
        centreX - left,
        BUBBLE_TAIL_INSET_PX,
        Math.max(BUBBLE_TAIL_INSET_PX, bubble.width - BUBBLE_TAIL_INSET_PX),
      );
}
