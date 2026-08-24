"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  FAB_VIEWPORT_MARGIN_PX as VIEWPORT_MARGIN_PX,
  readStoredFabPosition,
  writeStoredFabPosition,
  type FabPositionRatio,
} from "@/lib/fab-position";

/** Movement under this distance is a tap, so small finger jitter still opens the panel. */
const DRAG_THRESHOLD_PX = 6;
/**
 * A drag ends with a synthetic click, which must not reach the button. Time-boxing
 * the suppression self-heals when the pointer is released off-target and no click
 * ever arrives, so the next genuine tap is never swallowed.
 */
const CLICK_SUPPRESSION_MS = 250;

type Position = { left: number; top: number };
type Size = { width: number; height: number };

type DragOrigin = {
  pointerX: number;
  pointerY: number;
  left: number;
  top: number;
};

export type DraggableFab = {
  /** `undefined` until a position is set, so the default CSS corner stays authoritative. */
  style: CSSProperties | undefined;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Wraps the button's real action and drops the click that merely ended a drag. */
  handleClick: () => void;
};

/** Room the button may travel in, already excluding the safety margins. */
function freeSpace(size: Size) {
  return {
    x: Math.max(0, window.innerWidth - size.width - VIEWPORT_MARGIN_PX * 2),
    y: Math.max(0, window.innerHeight - size.height - VIEWPORT_MARGIN_PX * 2),
  };
}

/**
 * Adds pointer dragging (mouse, touch and pen through one Pointer Events path) to a
 * fixed-position button, and remembers where the user left it.
 *
 * The stored value is a ratio, and every pixel value is derived from it against the
 * live viewport, so the button is always inside the screen — on any device, after any
 * resize, and even if the saved data is stale. Nothing about how the button looks or
 * what it does lives here.
 */
export function useDraggableFab(
  onActivate: () => void,
  buttonRef: RefObject<HTMLButtonElement | null>,
): DraggableFab {
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef<DragOrigin | null>(null);
  const sizeRef = useRef<Size | null>(null);
  const movedRef = useRef(false);
  const dragEndedAtRef = useRef(0);
  /** The user's intent, kept as a ratio so it survives viewport changes. */
  const ratioRef = useRef<FabPositionRatio | null>(null);

  const measure = useCallback((): Size | null => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { width: rect.width, height: rect.height };
  }, [buttonRef]);

  const clamp = useCallback((left: number, top: number, size: Size): Position => {
    const free = freeSpace(size);
    return {
      left: Math.min(Math.max(left, VIEWPORT_MARGIN_PX), VIEWPORT_MARGIN_PX + free.x),
      top: Math.min(Math.max(top, VIEWPORT_MARGIN_PX), VIEWPORT_MARGIN_PX + free.y),
    };
  }, []);

  const toRatio = useCallback((next: Position, size: Size): FabPositionRatio => {
    const free = freeSpace(size);
    return {
      x: free.x === 0 ? 0 : (next.left - VIEWPORT_MARGIN_PX) / free.x,
      y: free.y === 0 ? 0 : (next.top - VIEWPORT_MARGIN_PX) / free.y,
    };
  }, []);

  const toPosition = useCallback(
    (ratio: FabPositionRatio, size: Size): Position => {
      const free = freeSpace(size);
      return {
        left: VIEWPORT_MARGIN_PX + ratio.x * free.x,
        top: VIEWPORT_MARGIN_PX + ratio.y * free.y,
      };
    },
    [],
  );

  // Restore the saved spot once the button exists and can be measured.
  useEffect(() => {
    const stored = readStoredFabPosition();
    if (!stored) return;

    const size = measure();
    // Unmeasurable button: stay in the default corner rather than risk a bad spot.
    if (!size) return;

    ratioRef.current = stored;
    setPosition(toPosition(stored, size));
  }, [measure, toPosition]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Let right/middle clicks and secondary buttons behave normally.
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const rect = event.currentTarget.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      pointerIdRef.current = event.pointerId;
      movedRef.current = false;
      // Capture keeps the drag tracking even when the pointer outruns the button.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = originRef.current;
      const size = sizeRef.current;
      if (!origin || !size || pointerIdRef.current !== event.pointerId) return;

      const dx = event.clientX - origin.pointerX;
      const dy = event.clientY - origin.pointerY;

      if (!movedRef.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        movedRef.current = true;
        setIsDragging(true);
      }

      const next = clamp(origin.left + dx, origin.top + dy, size);
      ratioRef.current = toRatio(next, size);
      setPosition(next);
    },
    [clamp, toRatio],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (movedRef.current) {
      dragEndedAtRef.current = Date.now();
      if (ratioRef.current) writeStoredFabPosition(ratioRef.current);
    }

    pointerIdRef.current = null;
    originRef.current = null;
    movedRef.current = false;
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (Date.now() - dragEndedAtRef.current < CLICK_SUPPRESSION_MS) return;
    onActivate();
  }, [onActivate]);

  /**
   * Re-derive the pixel spot from the saved ratio on resize and rotation. Because the
   * ratio is untouched, shrinking the window pulls the button in and growing it again
   * puts the button back where the user left it.
   */
  useEffect(() => {
    const onResize = () => {
      const ratio = ratioRef.current;
      if (!ratio) return;

      const size = measure();
      if (!size) return;

      setPosition(toPosition(ratio, size));
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [measure, toPosition]);

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!position) return undefined;

    // The neutralisers come first on purpose: later declarations win, so `left`
    // and `top` override the button's default logical inset classes.
    return {
      insetInlineStart: "auto",
      insetInlineEnd: "auto",
      bottom: "auto",
      left: position.left,
      top: position.top,
    };
  }, [position]);

  return {
    style,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    handleClick,
  };
}
