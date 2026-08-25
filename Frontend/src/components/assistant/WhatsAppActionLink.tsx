"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useT } from "@/i18n";
import { sanitizeWhatsAppHref } from "@/lib/ai-chat-whatsapp";

type WhatsAppActionLinkProps = {
  href: string;
  children: ReactNode;
};

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="wesal-ai-wa-glyph">
      <path d="M12 3.2A8.7 8.7 0 0 0 4.4 16.3L3.5 20.5l4.3-.9A8.7 8.7 0 1 0 12 3.2Zm4.7 12.3c-.2.5-1 .9-1.6 1-.4.1-.9.1-1.5-.1-1.4-.5-2.8-1.4-3.9-2.6-1-1.1-1.8-2.5-2.1-3.2-.2-.5 0-1 .3-1.3l.7-.8c.2-.2.4-.3.7-.3.1 0 .3 0 .4.2l1 1.7c.1.2.1.4 0 .6l-.3.5c-.1.2-.1.3 0 .5.4.7 1.1 1.5 1.9 2.1.7.6 1.4 1 2.1 1.2.2.1.4 0 .5-.1l.5-.5c.2-.2.4-.2.6-.1l1.7.9c.3.1.4.4.3.7l-.3.9Z" />
    </svg>
  );
}

/** Readable stand-in when a contact cannot be opened as a WhatsApp URL. */
function WhatsAppContactFallback({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" className="wesal-ai-wa-fallback" data-testid="ai-chat-whatsapp-fallback">
      {children}
    </span>
  );
}

/**
 * Inline WhatsApp contact inside assistant copy. Role-agnostic: guests, registered
 * users, hall owners, and admins all get the same external link. Clicks never
 * capture pointer events, so thread scroll, composer, and the panel close control
 * keep working.
 */
export default function WhatsAppActionLink({ href, children }: WhatsAppActionLinkProps) {
  const t = useT();
  const safeHref = sanitizeWhatsAppHref(href);

  if (!safeHref) {
    return <WhatsAppContactFallback>{children}</WhatsAppContactFallback>;
  }

  const label = typeof children === "string" && children.trim() ? children.trim() : safeHref;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!event.currentTarget.getAttribute("href")) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      draggable={false}
      dir="ltr"
      aria-label={t("assistant.chat.whatsappAria", { label })}
      data-testid="ai-chat-whatsapp-link"
      className="wesal-ai-wa-link"
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <WhatsAppGlyph />
      <span className="wesal-ai-wa-link-text">{children}</span>
    </a>
  );
}
