"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n";
import type { AdminModeratedContent } from "@/types/admin-moderation";

export type AdminModerationAction =
  | "view"
  | "deleteContent"
  | "lock"
  | "unlock";

type AdminActionToolbarProps = {
  item: AdminModeratedContent;
  disabled?: boolean;
  onAction: (action: AdminModerationAction, item: AdminModeratedContent) => void;
};

export default function AdminActionToolbar({
  item,
  disabled = false,
  onAction,
}: AdminActionToolbarProps) {
  const t = useT();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: AdminModerationAction) {
    setOpen(false);
    onAction(action, item);
  }

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-outline !min-h-11 px-3 text-xs"
        disabled={disabled}
        data-testid={`admin-moderation-view-${item.id}`}
        onClick={() => run("view")}
      >
        {t("admin.moderation.actions.view")}
      </button>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--wesal-muted)] transition hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-maroon)] disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        data-testid={`admin-moderation-menu-${item.id}`}
        onClick={() => setOpen((value) => !value)}
      >
        <DotsIcon />
        <span className="sr-only">{t("admin.moderation.actions.more")}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 top-[calc(100%+0.35rem)] z-30 min-w-[12.5rem] overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white py-1.5 shadow-[0_0.75rem_1.75rem_rgba(60,35,30,0.16)]"
        >
          <MenuItem
            onClick={() => run("view")}
            icon={<ViewIcon />}
            label={t("admin.moderation.actions.view")}
          />
          <MenuItem
            onClick={() => run("deleteContent")}
            icon={<TrashIcon />}
            label={t("admin.moderation.actions.deleteContent")}
          />
          {item.ownerIsLocked ? (
            <MenuItem
              onClick={() => run("unlock")}
              icon={<UnlockIcon />}
              label={t("admin.moderation.actions.unlockAccount")}
            />
          ) : (
            <MenuItem
              onClick={() => run("lock")}
              icon={<LockIcon />}
              label={t("admin.moderation.actions.lockAccount")}
              danger
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  danger = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm font-semibold transition hover:bg-[var(--wesal-pink-soft)] ${
        danger ? "text-[#b42318]" : "text-[var(--wesal-maroon-dark)]"
      }`}
      onClick={onClick}
    >
      <span className="opacity-80" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 4h6M5 7h14M9 7v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 10V8a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 10V8a4 4 0 0 1 7.5-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
