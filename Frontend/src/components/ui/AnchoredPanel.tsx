"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  useAnchoredPanelStyle,
  type AnchoredPanelOptions,
} from "@/hooks/useAnchoredPanelStyle";

type AnchoredPanelProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef?: Ref<HTMLElement | null>;
  options?: AnchoredPanelOptions;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "style" | "children" | "className">;

/**
 * Renders a floating panel in a body portal, positioned flush to an anchor.
 * Portaling avoids `position: fixed` being trapped by transformed/overflow ancestors
 * (modals), which otherwise makes menus appear far from their trigger.
 */
export default function AnchoredPanel({
  open,
  anchorRef,
  panelRef,
  options,
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: AnchoredPanelProps) {
  const [mounted, setMounted] = useState(false);
  const anchoredStyle = useAnchoredPanelStyle(open, anchorRef, options);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <Tag
      ref={panelRef}
      className={className}
      style={{ ...anchoredStyle, ...style }}
      {...rest}
    >
      {children}
    </Tag>,
    document.body,
  );
}
