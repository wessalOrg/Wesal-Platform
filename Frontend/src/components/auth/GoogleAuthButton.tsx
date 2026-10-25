"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [buttonHost, setButtonHost] = useState<HTMLDivElement | null>(null);
  const credentialHandler = useRef(onCredential);
  const renderedHost = useRef<HTMLDivElement | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const label = t("auth.google.continueAria");

  useEffect(() => {
    credentialHandler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!loaded || !clientId || renderedHost.current === buttonHost) return;

    const timeout = window.setTimeout(() => {
      if (renderedHost.current !== buttonHost) setRenderFailed(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [loaded, clientId, buttonHost]);

  useEffect(() => {
    if (!loaded || !clientId || !window.google) return;
    if (!buttonHost || renderedHost.current === buttonHost) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response) => {
          if (response.credential) credentialHandler.current(response.credential);
        },
      });
      window.google.accounts.id.disableAutoSelect?.();

      const width = Math.max(280, Math.floor(buttonHost.getBoundingClientRect().width || 320));
      window.google.accounts.id.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: String(width),
        locale: "ar",
      });
      renderedHost.current = buttonHost;
    } catch {
      queueMicrotask(() => setRenderFailed(true));
    }
  }, [loaded, clientId, buttonHost]);

  if (!clientId) {
    return (
      <p className="text-center text-xs text-[var(--wesal-muted)]" role="status">
        {t("auth.google.unavailable")}
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onReady={() => setLoaded(true)}
        onError={() => setRenderFailed(true)}
      />
      <div
        className={`relative w-full ${disabled ? "pointer-events-none opacity-60" : ""}`}
        data-testid="google-auth-button"
      >
        {/* Visible Wesal-styled face — Google's personalized chip stays invisible underneath. */}
        <div
          className="pointer-events-none flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] shadow-[0_1px_2px_rgba(60,64,67,0.08)]"
          aria-hidden="true"
        >
          <GoogleMark />
          <span>{label}</span>
        </div>

        <div
          ref={setButtonHost}
          className="absolute inset-0 z-10 overflow-hidden opacity-[0.02] [&_div]:!h-full [&_div]:!w-full [&_iframe]:!h-full [&_iframe]:!min-h-full [&_iframe]:!w-full"
          data-testid="google-auth-button-host"
          aria-label={label}
        />
      </div>
      {renderFailed ? (
        <p className="mt-2 text-center text-xs text-[#b42318]" role="alert">
          {t("auth.google.error")}
        </p>
      ) : null}
    </>
  );
}
