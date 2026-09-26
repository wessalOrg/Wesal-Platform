"use client";

import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { useT } from "@/i18n";

const MAX_LENGTH = 1000;
const COMPOSER_MAX_HEIGHT_PX = 112;

type MessageComposerProps = {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  variant?: "page" | "widget";
};

function resizeField(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
}

export default function MessageComposer({
  id,
  value,
  disabled,
  onChange,
  onSend,
  variant = "page",
}: MessageComposerProps) {
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
      className={`sticky bottom-0 z-20 shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        variant === "widget"
          ? "border-[var(--wesal-maroon)]/15 bg-[var(--wesal-pink)]"
          : "border-[var(--wesal-border)] bg-white"
      }`}
      onSubmit={submit}
    >
      <label className="sr-only" htmlFor={id}>
        {t("messages.composerPlaceholder")}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          ref={fieldRef}
          id={id}
          rows={1}
          value={value}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          placeholder={disabled ? t("messages.selectConversation") : t("messages.composerPlaceholder")}
          className={`max-h-28 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--wesal-maroon)] disabled:opacity-70 ${
            variant === "widget"
              ? "border-[var(--wesal-maroon)]/20 bg-white"
              : "border-[var(--wesal-border)] bg-[#faf7f4]"
          }`}
          enterKeyHint="send"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="btn-primary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 sm:h-auto sm:w-auto sm:min-w-[5.5rem] sm:px-4"
          disabled={!canSend}
          aria-label={t("messages.send")}
        >
          <span className="sm:hidden" aria-hidden="true">
            <SendIcon />
          </span>
          <span className="hidden sm:inline">{t("messages.send")}</span>
        </button>
      </div>
    </form>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5 rtl:-scale-x-100"
      aria-hidden="true"
    >
      <path d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L14.5 12 3.3 13.9z" />
    </svg>
  );
}
