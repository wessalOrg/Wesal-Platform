"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Detects whether clamped copy overflows so the card can offer Read more.
 */
export function useExpandableText(text: string, collapsedLines = 4) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  useLayoutEffect(() => {
    setExpanded(false);
    setCanToggle(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setCanToggle(el.scrollHeight > el.clientHeight + 1);
  }, [collapsedLines, expanded, text]);

  const toggle = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  return { textRef, expanded, canToggle, toggle };
}
