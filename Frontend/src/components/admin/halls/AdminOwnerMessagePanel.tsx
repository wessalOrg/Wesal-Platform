"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAdminOwnerMessage } from "@/components/admin/halls/AdminOwnerMessageProvider";
import MessageThreadView from "@/components/messages/MessageThreadView";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useAdminOwnerThread } from "@/hooks/useAdminOwnerThread";
import { useMessageDrafts } from "@/hooks/useMessageDrafts";
import { getCurrentUserId } from "@/lib/current-user";
import { floatingPanelBounds } from "@/lib/floating-panel-bounds";
import { useT } from "@/i18n";

const PANEL_MIN_WIDTH_PX = 280;
const PANEL_MIN_HEIGHT_PX = 320;
const PANEL_EDGE_GAP_PX = 12;
const PANEL_WIDE_BREAKPOINT_PX = 480;
const PANEL_SIZE_STORAGE_KEY = "wesal_admin_owner_message_size";
const DEFAULT_SIZE = { width: 352, height: 512 };
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

export default function AdminOwnerMessagePanel() {
  const t = useT();
  const { target, close } = useAdminOwnerMessage();
  const { ready, authenticated, sessionKey, userId, displayName } = useAccountAccess();
  const ownerKey = ready && authenticated ? sessionKey : null;
  const currentUserId = userId || getCurrentUserId();
  const threadState = useAdminOwnerThread(target, ownerKey);
  const draftKey = target ? `admin-hall:${target.hallId}` : null;
  const { draftFor, setDraft: persistDraft, restoreDraft } = useMessageDrafts(ownerKey);
  const [localDraft, setLocalDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const userSizeRef = useRef<PanelSize | null>(readStoredPanelSize());
  const compactBeforeExpandRef = useRef<PanelSize>(DEFAULT_SIZE);
  const resizingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const [size, setSize] = useState<PanelSize>(() => readStoredPanelSize() ?? DEFAULT_SIZE);
  const isOpen = Boolean(target);
  const isWide = size.width >= PANEL_WIDE_BREAKPOINT_PX;

  const applySize = useCallback((next: PanelSize) => {
    const panel = panelRef.current;
    if (!panel || typeof window === "undefined") return;

    const { maxWidth, maxHeight, minWidth, minHeight } = floatingPanelBounds(
      PANEL_EDGE_GAP_PX,
      PANEL_MIN_WIDTH_PX,
      PANEL_MIN_HEIGHT_PX,
    );
    const sheetMode = window.innerWidth < 480;
    const width = sheetMode ? maxWidth : clamp(next.width, minWidth, maxWidth);
    const height = clamp(next.height, minHeight, maxHeight);
    const left = PANEL_EDGE_GAP_PX;
    const top = clamp(
      window.innerHeight - height - PANEL_EDGE_GAP_PX,
      PANEL_EDGE_GAP_PX,
      Math.max(PANEL_EDGE_GAP_PX, window.innerHeight - minHeight - PANEL_EDGE_GAP_PX),
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
    applySize(userSizeRef.current ?? DEFAULT_SIZE);
  }, [applySize]);

  const toggleExpand = useCallback(() => {
    if (typeof window === "undefined") return;
    const { maxWidth, maxHeight, minWidth, minHeight } = floatingPanelBounds(
      PANEL_EDGE_GAP_PX,
      PANEL_MIN_WIDTH_PX,
      PANEL_MIN_HEIGHT_PX,
    );
    const expandedTarget: PanelSize = {
      width: clamp(EXPANDED_SIZE.width, minWidth, maxWidth),
      height: clamp(EXPANDED_SIZE.height, minHeight, maxHeight),
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
    const draft = draftKey ? draftFor(draftKey) : "";
    const timer = window.setTimeout(() => setLocalDraft(draft), 0);
    return () => window.clearTimeout(timer);
  }, [draftFor, draftKey]);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, target]);

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
    const pinnedBottom = startRect.bottom;
    const pinnedInlineStart = isRtl ? startRect.right : startRect.left;
    const bounds = () =>
      floatingPanelBounds(PANEL_EDGE_GAP_PX, PANEL_MIN_WIDTH_PX, PANEL_MIN_HEIGHT_PX);

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

      const live = bounds();
      const widthDelta = isRtl ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const heightDelta = startY - moveEvent.clientY;
      const nextSize: PanelSize = {
        width: clamp(startWidth + widthDelta, live.minWidth, live.maxWidth),
        height: clamp(startHeight + heightDelta, live.minHeight, live.maxHeight),
      };
      const nextTop = clamp(
        pinnedBottom - nextSize.height,
        PANEL_EDGE_GAP_PX,
        Math.max(PANEL_EDGE_GAP_PX, window.innerHeight - live.minHeight - PANEL_EDGE_GAP_PX),
      );
      const nextLeft = isRtl
        ? clamp(
            pinnedInlineStart - nextSize.width,
            PANEL_EDGE_GAP_PX,
            Math.max(PANEL_EDGE_GAP_PX, window.innerWidth - live.minWidth - PANEL_EDGE_GAP_PX),
          )
        : clamp(
            pinnedInlineStart,
            PANEL_EDGE_GAP_PX,
            Math.max(PANEL_EDGE_GAP_PX, window.innerWidth - nextSize.width - PANEL_EDGE_GAP_PX),
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

  const onDraftChange = useCallback(
    (value: string) => {
      setLocalDraft(value);
      if (draftKey) persistDraft(draftKey, value);
    },
    [draftKey, persistDraft],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (draftKey) persistDraft(draftKey, "");
      setLocalDraft("");
      const sent = await threadState.send(text, currentUserId, displayName || "");
      if (!sent) {
        setLocalDraft(text);
        if (draftKey) restoreDraft(draftKey, text);
      }
    },
    [currentUserId, displayName, draftKey, persistDraft, restoreDraft, threadState],
  );

  if (!target) return null;

  const subtitle = target.ownerName
    ? t("admin.halls.message.withOwner", { name: target.ownerName })
    : t("admin.halls.message.ownerFallback");

  const blockedNotice = threadState.deliveryPending ? (
    <p
      className="rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a12]"
      role="status"
      data-testid="admin-owner-delivery-pending"
    >
      {t("admin.halls.message.deliveryPending")}
    </p>
  ) : threadState.errorKey ? (
    <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
      {t(threadState.errorKey)}
    </p>
  ) : null;

  const iconBtnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wesal-maroon)]/45 bg-white text-[var(--wesal-maroon)] shadow-[0_4px_12px_rgba(193,123,127,0.16)] transition hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white";

  return (
    <div className="fixed inset-0 z-[107]" role="presentation" data-testid="admin-owner-message-overlay">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/20"
        aria-label={t("common.close")}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-owner-message-title"
        data-testid="admin-owner-message-panel"
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
          <h2
            id="admin-owner-message-title"
            className="truncate text-base font-bold text-[var(--wesal-maroon)]"
          >
            {t("admin.halls.message.title")}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`${iconBtnClass} wesal-messages-inbox-resize`}
              aria-label={t(isWide ? "messages.collapseInbox" : "messages.expandInbox")}
              title={t(isWide ? "messages.collapseInbox" : "messages.expandInbox")}
              data-testid="admin-owner-message-resize"
              data-expanded={isWide ? "true" : "false"}
              onPointerDown={onResizePointerDown}
            >
              <ResizeIcon />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              aria-label={t("messages.closeInbox")}
              data-testid="admin-owner-message-close"
              onClick={close}
            >
              ✕
            </button>
          </div>
        </div>

        <MessageThreadView
          status={threadState.status}
          thread={threadState.thread}
          error={threadState.errorKey ? t(threadState.errorKey) : null}
          title={target.hallName || t("common.hall")}
          subtitle={subtitle}
          currentUserId={currentUserId}
          onRetryLoad={threadState.retry}
          onRetrySend={(messageId) => {
            void threadState.retrySend(messageId, currentUserId, displayName || "");
          }}
          onSend={(text) => {
            void sendMessage(text);
          }}
          draft={localDraft}
          onDraftChange={onDraftChange}
          composerEnabled={
            Boolean(ownerKey) &&
            !threadState.sending &&
            threadState.status !== "loading" &&
            threadState.status !== "idle"
          }
          onBack={close}
          composerId="admin-owner-message-draft"
          conversationId={threadState.conversationId}
          variant="widget"
          notice={blockedNotice}
        />
      </div>
    </div>
  );
}

function ResizeIcon() {
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
