"use client";

import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { useT } from "@/i18n";

const MAX_LENGTH = 1000;
const COMPOSER_MAX_HEIGHT_PX = 112;

type AdminMessageComposerProps = {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
};

function resizeField(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
}

export default function AdminMessageComposer({
  id,
  value,
  disabled,
  onChange,
  onSend,
}: AdminMessageComposerProps) {
  const t = useT();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0 && trimmed.length <= MAX_LENGTH;

  useLayoutEffect(() => {
    resizeField(fieldRef.current);
  }, [value]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
  };

  return (
    <form
      className="sticky bottom-0 z-20 shrink-0 border-t border-[var(--wesal-border)] bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      onSubmit={submit}
      data-testid="admin-message-composer"
    >
      <label className="sr-only" htmlFor={id}>
        {t("messages.composerPlaceholder")}
      </label>
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
          aria-label={t("admin.messages.composer.attach")}
          disabled
          title={t("admin.messages.composer.attachSoon")}
        >
          <PaperclipIcon />
        </button>

        <div className="relative min-w-0 flex-1">
          <textarea
            ref={fieldRef}
            id={id}
            rows={1}
            value={value}
            disabled={disabled}
            maxLength={MAX_LENGTH}
            placeholder={
              disabled ? t("messages.selectConversation") : t("messages.composerPlaceholder")
            }
            className="max-h-28 min-h-11 w-full resize-none overflow-y-auto rounded-2xl border border-[var(--wesal-border)] bg-[#faf7f4] py-2.5 pe-10 ps-3 text-sm leading-6 outline-none focus:border-[var(--wesal-maroon)] disabled:opacity-70"
            enterKeyHint="send"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span
            className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[var(--wesal-muted)]"
            aria-hidden="true"
          >
            <EmojiIcon />
          </span>
        </div>

        <button
          type="submit"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--wesal-maroon-dark)] text-white transition enabled:hover:bg-[var(--wesal-maroon)] disabled:opacity-45"
          disabled={!canSend}
          aria-label={t("messages.send")}
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8.5 12.5 14 7a3.2 3.2 0 1 1 4.5 4.5l-7.2 7.2a4.6 4.6 0 0 1-6.5-6.5l7-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 10.2h.01M15 10.2h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.2 14c.9 1.1 2.1 1.7 2.8 1.7s1.9-.6 2.8-1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
      <path
        d="M4.5 11.2 19 4.8l-4.2 14.4-3.1-5.4-5.4-2.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
