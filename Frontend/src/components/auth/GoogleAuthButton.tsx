"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";

declare global {
  interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } }
}

export default function GoogleAuthButton({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [buttonHost, setButtonHost] = useState<HTMLDivElement | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  useEffect(() => {
    if (!loaded || !clientId || !window.google) return;
    const target = buttonHost;
    if (!target) return;
    target.replaceChildren();
    window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => { if (response.credential) onCredential(response.credential); } });
    window.google.accounts.id.renderButton(target, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: "360", locale: "ar" });
  }, [loaded, clientId, onCredential, buttonHost]);
  if (!clientId) return <p className="text-center text-xs text-[var(--wesal-muted)]" role="status">{t("auth.google.unavailable")}</p>;
  return <><Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setLoaded(true)} /><div className={`flex min-h-10 justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}><div ref={setButtonHost} /></div></>;
}
