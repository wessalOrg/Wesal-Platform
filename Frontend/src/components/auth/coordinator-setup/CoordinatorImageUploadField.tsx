"use client";

import { useEffect, useId, useRef, type ChangeEvent } from "react";
import { useT } from "@/i18n";

type CoordinatorImageUploadFieldProps = {
  label: string;
  hint: string;
  required?: boolean;
  /** Shorter dropzone that still spans full width */
  compact?: boolean;
  accept: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
  testId?: string;
};

export default function CoordinatorImageUploadField({
  label,
  hint,
  required = false,
  compact = false,
  accept,
  file,
  error,
  onChange,
  testId,
}: CoordinatorImageUploadFieldProps) {
  const t = useT();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl =
    file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
  const areaClass = compact
    ? "min-h-[5.75rem] w-full sm:min-h-[6.25rem]"
    : "aspect-[4/3] w-full";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    onChange(next);
  };

  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[0.82rem] font-semibold text-[var(--wesal-text)]">{label}</span>
        {required ? (
          <span className="text-[#c45b55]" aria-hidden="true">
            *
          </span>
        ) : null}
      </div>

      <div
        className={`wesal-role-setup-upload relative overflow-hidden !rounded-xl ${
          error ? "!border-[#c45b55]" : ""
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={onPick}
        />

        {previewUrl ? (
          <div className={`relative ${areaClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-black/45 p-1.5">
              <button
                type="button"
                className="flex-1 rounded-md bg-white/95 px-1.5 py-1 text-[0.65rem] font-bold text-[var(--wesal-maroon)]"
                onClick={() => inputRef.current?.click()}
              >
                {t("auth.coordinator.setup.replaceImage")}
              </button>
              <button
                type="button"
                className="rounded-md bg-white/95 px-1.5 py-1 text-[0.65rem] font-bold text-[#b42318]"
                onClick={() => onChange(null)}
              >
                {t("auth.coordinator.setup.removeImage")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex ${areaClass} flex-col items-center justify-center gap-1 px-2 py-2 text-center`}
          >
            <span
              className="grid size-8 place-items-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-sm"
              aria-hidden="true"
            >
              <UploadIcon />
            </span>
            <span className="px-1 text-[0.68rem] font-semibold leading-4 text-[var(--wesal-maroon)]">
              {hint}
            </span>
            <span className="text-[0.62rem] text-[var(--wesal-muted)]">
              {t("auth.coordinator.setup.uploadMeta")}
            </span>
          </button>
        )}
      </div>

      {file && !previewUrl ? (
        <p className="mt-1.5 truncate text-xs text-[var(--wesal-muted)]" dir="ltr">
          {file.name}
        </p>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10.2" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 16.2 9.2 12.8l2.4 2.2 3-3.4 3.9 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
