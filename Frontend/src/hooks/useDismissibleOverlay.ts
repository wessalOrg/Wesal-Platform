"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";

/**
 * Open/close state for popovers and menus: closes on route change,
 * outside pointer, and Escape.
 */
export function useDismissibleOverlay(
  extraContains?: Array<RefObject<HTMLElement | null>>,
) {
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (extraContains?.some((ref) => ref.current?.contains(target))) return;
      if (
        target instanceof Element &&
        target.closest("[data-testid='account-notifications-panel']")
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, extraContains]);

  return { open, setOpen, close, toggle, rootRef, panelId };
}
