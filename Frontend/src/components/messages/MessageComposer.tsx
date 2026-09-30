"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  appearance?: "default" | "owner";
  attachmentPreviewUrl?: string | null;
  attachmentName?: string | null;
  attachmentBusy?: boolean;
  onPickAttachment?: (file: File) => void;
  onClearAttachment?: () => void;
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
  appearance = "default",
  attachmentPreviewUrl = null,
  attachmentName = null,
  attachmentBusy = false,
  onPickAttachment,
  onClearAttachment,
}: MessageComposerProps) {
  const t = useT();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const trimmed = (value ?? "").trim();
  const canSend =
    !disabled &&
    !attachmentBusy &&
    (trimmed.length > 0 || Boolean(attachmentPreviewUrl)) &&
    trimmed.length <= MAX_LENGTH;

  useLayoutEffect(() => {
    resizeField(fieldRef.current);
  }, [value]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
  };

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file && onPickAttachment) onPickAttachment(file);
  };

  const onDragOver = (event: DragEvent<HTMLFormElement>) => {
    if (!onPickAttachment || disabled || attachmentBusy) return;
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLFormElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    if (!onPickAttachment || disabled || attachmentBusy) return;
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onPickAttachment(dropped);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
  };

  const owner = appearance === "owner";

  return (
    <form
      className={`sticky bottom-0 z-20 shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        owner
          ? "owner-chat-composer"
          : variant === "widget"
            ? "border-[var(--wesal-maroon)]/15 bg-[var(--wesal-pink)]"
            : "border-[var(--wesal-border)] bg-white"
      } ${dragging ? "ring-2 ring-inset ring-[var(--wesal-gold)]" : ""}`}
      onSubmit={submit}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <label className="sr-only" htmlFor={id}>
        {t("messages.composerPlaceholder")}
      </label>
      {attachmentPreviewUrl ? (
        <div
          className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-white p-2"
          data-testid="message-attachment-preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img
            src={attachmentPreviewUrl}
            alt=""
            className="h-14 w-16 shrink-0 rounded-lg object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-xs text-[var(--wesal-muted)]">
            {attachmentName || t("messages.attachReceipt")}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-[#c45b55]"
            disabled={disabled || attachmentBusy}
            onClick={onClearAttachment}
          >
            {t("messages.attachRemove")}
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        {onPickAttachment ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || attachmentBusy}
              onChange={onPickFile}
            />
            <button
              type="button"
              className={
                owner
                  ? "owner-chat-attach"
                  : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--wesal-border)] bg-white text-[var(--wesal-maroon)] disabled:opacity-60"
              }
              disabled={disabled || attachmentBusy}
              aria-label={t("messages.attachReceipt")}
              data-testid="message-attach-receipt"
              onClick={() => fileRef.current?.click()}
            >
              <AttachIcon />
            </button>
          </>
        ) : null}
        <textarea
          ref={fieldRef}
          id={id}
          rows={1}
          value={value}
          disabled={disabled || attachmentBusy}
          maxLength={MAX_LENGTH}
          placeholder={disabled ? t("messages.selectConversation") : t("messages.composerPlaceholder")}
          className={`max-h-28 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto px-3 py-2.5 text-sm leading-6 outline-none disabled:opacity-70 ${
            owner
              ? "owner-chat-field"
              : variant === "widget"
                ? "rounded-xl border border-[var(--wesal-maroon)]/20 bg-white focus:border-[var(--wesal-maroon)]"
                : "rounded-xl border border-[var(--wesal-border)] bg-[#faf7f4] focus:border-[var(--wesal-maroon)]"
          }`}
          enterKeyHint="send"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className={
            owner
              ? "owner-chat-send"
              : "btn-primary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 sm:h-auto sm:w-auto sm:min-w-[5.5rem] sm:px-4"
          }
          disabled={!canSend}
          aria-label={t("messages.send")}
        >
          <span className={owner ? "sr-only" : "hidden sm:inline"}>
            {attachmentBusy ? t("messages.attaching") : t("messages.send")}
          </span>
          <span className={owner ? "" : "sm:hidden"} aria-hidden={owner ? undefined : true}>
            <SendIcon />
          </span>
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

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8 12.5 14.2 6.3a3 3 0 1 1 4.2 4.3l-7.5 7.4a4.2 4.2 0 0 1-6-6l7.1-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
