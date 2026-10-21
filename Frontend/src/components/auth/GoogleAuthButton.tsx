"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";

declare global {
  interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } }
}

export default function GoogleAuthButton({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [buttonHost, setButtonHost] = useState<HTMLDivElement | null>(null);
  const credentialHandler = useRef(onCredential);
  const renderedHost = useRef<HTMLDivElement | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    credentialHandler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!loaded || !clientId || !window.google) return;
    if (!buttonHost || renderedHost.current === buttonHost) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) credentialHandler.current(response.credential);
        },
      });
      const availableWidth = Math.floor(buttonHost.getBoundingClientRect().width);
      const buttonWidth = Math.max(200, Math.min(360, availableWidth || 360));
      window.google.accounts.id.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: String(buttonWidth),
        locale: "ar",
      });
      renderedHost.current = buttonHost;
    } catch {
      queueMicrotask(() => setRenderFailed(true));
    }
  }, [loaded, clientId, buttonHost]);

  if (!clientId) return <p className="text-center text-xs text-[var(--wesal-muted)]" role="status">{t("auth.google.unavailable")}</p>;
  return <>
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setLoaded(true)}
      onError={() => setRenderFailed(true)}
    />
    <div className={`flex min-h-10 w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div ref={setButtonHost} className="w-full max-w-[360px]" data-testid="google-auth-button-host" />
    </div>
    {renderFailed ? <p className="mt-2 text-center text-xs text-[#b42318]" role="alert">{t("auth.google.error")}</p> : null}
  </>;
}
