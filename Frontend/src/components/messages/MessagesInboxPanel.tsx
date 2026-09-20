"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import ConversationList from "@/components/messages/ConversationList";
import MessageThreadView from "@/components/messages/MessageThreadView";
import ProtectedHallMessageThread from "@/components/messages/ProtectedHallMessageThread";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import {
  conversationHallLabel,
  conversationPreviewSubtitle,
  conversationPreviewTitle,
} from "@/lib/conversation-display";

const PANEL_MIN_WIDTH_PX = 280;
const PANEL_MIN_HEIGHT_PX = 320;
const PANEL_EDGE_GAP_PX = 12;
const PANEL_WIDE_BREAKPOINT_PX = 480;
const PANEL_SIZE_STORAGE_KEY = "wesal_messages_inbox_size";
const DEFAULT_SIZE = { width: 352, height: 480 };
const EXPANDED_SIZE = { width: 720, height: 640 };
const DRAG_THRESHOLD_PX = 5;

type PanelSize = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredPanelSize(): PanelSize | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number" ||
      !Number.isFinite(parsed.width) ||
      !Number.isFinite(parsed.height)
    ) {
      return null;
    }
    return {
      width: clamp(parsed.width, PANEL_MIN_WIDTH_PX, 1200),
      height: clamp(parsed.height, PANEL_MIN_HEIGHT_PX, 1200),
    };
  } catch {
    return null;
  }
}

function storePanelSize(size: PanelSize): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function MessagesInboxPanel() {
  const t = useT();
  const lang = useUiLang();
  const {
    isOpen,
    selectedId,
    canUseMessaging,
    currentUserId,
    inboxStatus,
    conversations,
    inboxError,
    retryInbox,
    threadStatus,
    thread,
    threadError,
    retryThread,
    draft,
    setDraft,
    sendMessage,
    retrySend,
    closeInbox,
    selectConversation,
  } = useMessagesInbox();

  const panelRef = useRef<HTMLDivElement>(null);
  const userSizeRef = useRef<PanelSize | null>(readStoredPanelSize());
  const compactBeforeExpandRef = useRef<PanelSize>(DEFAULT_SIZE);
  const resizingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const [size, setSize] = useState<PanelSize>(() => readStoredPanelSize() ?? DEFAULT_SIZE);

  const selected = conversations.find((item) => item.conversationId === selectedId) ?? null;
  const showThread = Boolean(selectedId);
  const isWide = size.width >= PANEL_WIDE_BREAKPOINT_PX;

  const applySize = useCallback((next: PanelSize) => {
    const panel = panelRef.current;
    if (!panel || typeof window === "undefined") return;

    const maxWidth = Math.max(PANEL_MIN_WIDTH_PX, window.innerWidth - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = Math.max(PANEL_MIN_HEIGHT_PX, window.innerHeight - PANEL_EDGE_GAP_PX * 2);
    const width = clamp(next.width, PANEL_MIN_WIDTH_PX, maxWidth);
    const height = clamp(next.height, PANEL_MIN_HEIGHT_PX, maxHeight);
    const left = PANEL_EDGE_GAP_PX;
    const top = clamp(
      window.innerHeight - height - PANEL_EDGE_GAP_PX,
      PANEL_EDGE_GAP_PX,
      window.innerHeight - PANEL_MIN_HEIGHT_PX - PANEL_EDGE_GAP_PX,
    );
    const applied = { width, height };

    userSizeRef.current = applied;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.bottom = "auto";
    setSize(applied);
    storePanelSize(applied);
  }, []);

  const place = useCallback(() => {
    const next = userSizeRef.current ?? DEFAULT_SIZE;
    applySize(next);
  }, [applySize]);

  const toggleExpand = useCallback(() => {
    if (typeof window === "undefined") return;
    const maxWidth = Math.max(PANEL_MIN_WIDTH_PX, window.innerWidth - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = Math.max(PANEL_MIN_HEIGHT_PX, window.innerHeight - PANEL_EDGE_GAP_PX * 2);
    const expandedTarget: PanelSize = {
      width: clamp(EXPANDED_SIZE.width, PANEL_MIN_WIDTH_PX, maxWidth),
      height: clamp(EXPANDED_SIZE.height, PANEL_MIN_HEIGHT_PX, maxHeight),
    };

    if (isWide) {
      applySize(compactBeforeExpandRef.current);
      return;
    }

    compactBeforeExpandRef.current = userSizeRef.current ?? size;
    applySize(expandedTarget);
  }, [applySize, isWide, size]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      if (resizingRef.current) return;
      place();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInbox();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeInbox]);

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = panel.getBoundingClientRect();
    const startWidth = startRect.width;
    const startHeight = startRect.height;
    const isRtl = document.documentElement.dir === "rtl";
    // Handle sits beside the close button (top-inline-end). Pin the opposite corner.
    const pinnedBottom = startRect.bottom;
    const pinnedInlineStart = isRtl ? startRect.right : startRect.left;
    const maxWidth = () =>
      Math.max(PANEL_MIN_WIDTH_PX, window.innerWidth - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = () =>
      Math.max(PANEL_MIN_HEIGHT_PX, window.innerHeight - PANEL_EDGE_GAP_PX * 2);

    dragMovedRef.current = false;
    resizingRef.current = true;
    panel.dataset.resizing = "true";
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const absX = Math.abs(moveEvent.clientX - startX);
      const absY = Math.abs(moveEvent.clientY - startY);
      if (!dragMovedRef.current) {
        if (absX < DRAG_THRESHOLD_PX && absY < DRAG_THRESHOLD_PX) return;
        dragMovedRef.current = true;
        document.body.style.cursor = isRtl ? "nesw-resize" : "nwse-resize";
        document.body.style.userSelect = "none";
      }

      const widthDelta = isRtl ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const heightDelta = startY - moveEvent.clientY;
      const nextSize: PanelSize = {
        width: clamp(startWidth + widthDelta, PANEL_MIN_WIDTH_PX, maxWidth()),
        height: clamp(startHeight + heightDelta, PANEL_MIN_HEIGHT_PX, maxHeight()),
      };
      const nextTop = clamp(
        pinnedBottom - nextSize.height,
        PANEL_EDGE_GAP_PX,
        window.innerHeight - PANEL_MIN_HEIGHT_PX - PANEL_EDGE_GAP_PX,
      );
      const nextLeft = isRtl
        ? clamp(
            pinnedInlineStart - nextSize.width,
            PANEL_EDGE_GAP_PX,
            window.innerWidth - PANEL_MIN_WIDTH_PX - PANEL_EDGE_GAP_PX,
          )
        : clamp(
            pinnedInlineStart,
            PANEL_EDGE_GAP_PX,
            window.innerWidth - PANEL_MIN_WIDTH_PX - PANEL_EDGE_GAP_PX,
          );

      userSizeRef.current = nextSize;
      panel.style.width = `${nextSize.width}px`;
      panel.style.height = `${nextSize.height}px`;
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      panel.style.bottom = "auto";
      setSize(nextSize);
    };

    const onUp = (upEvent: PointerEvent) => {
      resizingRef.current = false;
      panel.dataset.resizing = "false";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        handle.releasePointerCapture(upEvent.pointerId);
      } catch {
        /* already released */
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);

      if (!dragMovedRef.current) {
        toggleExpand();
        return;
      }

      if (userSizeRef.current) storePanelSize(userSizeRef.current);
      place();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  if (!isOpen) return null;

  const threadTitle = selected
    ? conversationPreviewTitle(selected, lang)
    : thread
      ? conversationHallLabel(thread, lang)
      : t("messages.title");
  const threadSubtitle = selected
    ? conversationPreviewSubtitle(selected, lang)
    : thread && conversationHallLabel(thread, lang) !== threadTitle
      ? conversationHallLabel(thread, lang)
      : null;

  const iconBtnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wesal-maroon)]/45 bg-white text-[var(--wesal-maroon)] shadow-[0_4px_12px_rgba(193,123,127,0.16)] transition hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white";

  return (
    <div
      className="fixed inset-0 z-[106]"
      role="presentation"
      data-testid="messages-inbox-overlay"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label={t("common.close")}
        onClick={closeInbox}
      />
      <div
        ref={panelRef}
        id="messages-inbox-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="messages-inbox-title"
        data-inbox-size={isWide ? "expanded" : "compact"}
        data-resizing="false"
        className="wesal-messages-inbox-panel absolute flex flex-col overflow-hidden rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[var(--wesal-pink)] shadow-[0_18px_44px_rgba(90,55,45,0.22)]"
        style={{
          width: size.width,
          height: size.height,
          left: PANEL_EDGE_GAP_PX,
          top: `calc(100svh - ${size.height + PANEL_EDGE_GAP_PX}px)`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--wesal-maroon)]/15 px-3 py-2.5">
          <h2 id="messages-inbox-title" className="text-base font-bold text-[var(--wesal-maroon)]">
            {t("messages.inboxTitle")}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`${iconBtnClass} wesal-messages-inbox-resize`}
              aria-label={t(isWide ? "messages.collapseInbox" : "messages.expandInbox")}
              title={t(isWide ? "messages.collapseInbox" : "messages.expandInbox")}
              data-testid="messages-inbox-resize"
              data-expanded={isWide ? "true" : "false"}
              onPointerDown={onResizePointerDown}
            >
              {isWide ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <button
              type="button"
              className={iconBtnClass}
              aria-label={t("messages.closeInbox")}
              data-testid="messages-inbox-close"
              onClick={closeInbox}
            >
              ✕
            </button>
          </div>
        </div>

        {!canUseMessaging ? (
          <div className="px-4 py-6" data-testid="inbox-unauthorized">
            <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.loginInbox")}</p>
            <Link href="/login" className="btn-primary mt-4 inline-flex" onClick={closeInbox}>
              {t("messages.goLogin")}
            </Link>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1">
            <div
              className={`min-h-0 overflow-y-auto ${
                isWide
                  ? `w-full shrink-0 sm:w-64 sm:border-e sm:border-[var(--wesal-maroon)]/15 ${showThread ? "hidden sm:block" : "block"}`
                  : `w-full ${showThread ? "hidden" : "block"}`
              }`}
            >
              <ConversationList
                status={inboxStatus}
                conversations={conversations}
                selectedId={selectedId}
                error={inboxError}
                onSelect={selectConversation}
                onRetry={retryInbox}
                variant="widget"
              />
            </div>
            <div
              className={`min-h-0 min-w-0 flex-1 ${
                isWide ? (showThread ? "flex" : "hidden sm:flex") : showThread ? "flex" : "hidden"
              }`}
            >
              <ProtectedHallMessageThread hallId={selected?.hallId ?? thread?.hallId}>
              <MessageThreadView
                status={threadStatus}
                thread={thread}
                error={threadError}
                title={threadTitle}
                subtitle={threadSubtitle}
                currentUserId={currentUserId}
                onRetryLoad={retryThread}
                onRetrySend={retrySend}
                onSend={(text) => {
                  void sendMessage(text);
                }}
                draft={draft}
                onDraftChange={setDraft}
                composerEnabled={
                  Boolean(selectedId) &&
                  threadStatus !== "loading" &&
                  threadStatus !== "error" &&
                  threadStatus !== "idle"
                }
                onBack={() => selectConversation(null)}
                conversationId={selectedId}
                variant="widget"
              />
              </ProtectedHallMessageThread>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M21 15v6h-6" />
      <path d="M3 9V3h6" />
    </svg>
  );
}
