"use client";

import { useT } from "@/i18n";

type MobileSidebarTriggerProps = {
  isSidebarOpen: boolean;
  sidebarId: string;
  onOpen: () => void;
  onClose: () => void;
  openLabelKey?: string;
  closeLabelKey?: string;
};

export default function MobileSidebarTrigger({
  isSidebarOpen,
  sidebarId,
  onOpen,
  onClose,
  openLabelKey = "owner.management.openMenu",
  closeLabelKey = "owner.management.closeMenu",
}: MobileSidebarTriggerProps) {
  const t = useT();

  return (
    <button
      type="button"
      className="owner-mgmt-menu-trigger"
      aria-expanded={isSidebarOpen}
      aria-controls={sidebarId}
      data-testid="owner-management-menu-trigger"
      onClick={() => {
        if (isSidebarOpen) onClose();
        else onOpen();
      }}
    >
      <span className="owner-mgmt-menu-trigger-icon" aria-hidden="true">
        {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
      </span>
      <span>
        {isSidebarOpen ? t(closeLabelKey) : t(openLabelKey)}
      </span>
    </button>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
