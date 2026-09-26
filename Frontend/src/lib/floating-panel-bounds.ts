/**
 * Viewport-safe bounds for floating message panels.
 * Preferred mins are lowered when the viewport cannot fit them (short phones / landscape).
 */
export function floatingPanelBounds(
  edgeGapPx: number,
  preferredMinWidth: number,
  preferredMinHeight: number,
): {
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
} {
  const maxWidth = Math.max(200, window.innerWidth - edgeGapPx * 2);
  const maxHeight = Math.max(200, window.innerHeight - edgeGapPx * 2);
  return {
    maxWidth,
    maxHeight,
    minWidth: Math.min(preferredMinWidth, maxWidth),
    minHeight: Math.min(preferredMinHeight, maxHeight),
  };
}
