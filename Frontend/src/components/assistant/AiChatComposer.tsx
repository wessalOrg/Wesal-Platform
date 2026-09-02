"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useT } from "@/i18n";
import type { AiChatSendState } from "@/types/ai-chat";

type AiChatComposerProps = {
  disabled: boolean;
  sending: boolean;
  sendState?: AiChatSendState;
  onSend: (text: string) => Promise<boolean> | boolean;
};

const COMPOSER_MAX_HEIGHT_PX = 112;

function resizeComposerField(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
}

/** Question input. Enter sends; Shift+Enter inserts a newline. */
export default function AiChatComposer({
  disabled,
  sending,
  sendState,
  onSend,
}: AiChatComposerProps) {
  const t = useT();
  const [value, setValue] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const locked = disabled || sending;

  useEffect(() => {
    if (disabled) return;
    fieldRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (sendState !== "success") return;
    setValue("");
  }, [sendState]);

  useLayoutEffect(() => {
    resizeComposerField(fieldRef.current);
  }, [value]);

  const submit = async () => {
    if (locked || composingRef.current) return;
    const text = value.trim();
    if (!text) return;
    let sent = false;
    try {
      sent = (await onSend(text)) === true;
    } catch {
      sent = false;
    }
    if (sent) {
      setValue("");
    }
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field || field.disabled) return;
      field.focus();
      resizeComposerField(field);
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || composingRef.current || event.keyCode === 229) {
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="wesal-ai-composer shrink-0 border-t border-[var(--wesal-border)] bg-white px-4 py-3"
      data-testid="ai-chat-composer"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={fieldRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          disabled={locked}
          rows={1}
          maxLength={500}
          dir="auto"
          enterKeyHint="send"
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck
          placeholder={t("assistant.composer.placeholder")}
          aria-label={t("assistant.composer.placeholder")}
          aria-busy={sending}
          data-testid="ai-chat-input"
          className="wesal-ai-composer-field max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-2.5 text-base leading-5 text-[var(--wesal-text)] placeholder:text-[var(--wesal-muted)] outline-none focus-visible:border-[var(--wesal-maroon-soft)] disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-10 sm:text-[0.8rem]"
        />
        <button
          type="submit"
          disabled={locked || !value.trim()}
          aria-label={t("assistant.composer.send")}
          data-testid="ai-chat-send"
          className="wesal-ai-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-70 sm:h-10 sm:w-10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="wesal-ai-send-icon h-4 w-4"
          >
            <path d="M4.6 4.3 20.2 11.4a.65.65 0 0 1 0 1.2L4.6 19.7a.65.65 0 0 1-.9-.75l1.5-5.6a.65.65 0 0 1 .53-.48l6.6-.87-6.6-.87a.65.65 0 0 1-.53-.48l-1.5-5.6a.65.65 0 0 1 .9-.75Z" />
          </svg>
        </button>
      </div>
      {sending ? (
        <p className="mt-2 text-center text-[0.65rem] text-[var(--wesal-muted)]" aria-live="polite">
          {t("assistant.chat.sending")}
        </p>
      ) : null}
    </form>
  );
}
