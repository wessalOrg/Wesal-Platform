import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AiAssistantProvider } from "@/components/assistant/AiAssistantProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import HallOwnerAudioAlerts from "@/components/halls/notifications/HallOwnerAudioAlerts";
import NotificationEventsBridge from "@/components/notifications/NotificationEventsBridge";
import NotificationToastHost from "@/components/notifications/NotificationToastHost";
import { AudioPermissionProvider } from "@/hooks/useAudioPermission";
import MessagesInboxPanelHost from "@/components/messages/MessagesInboxPanelHost";
import { MessagesInboxProvider } from "@/components/messages/MessagesInboxProvider";
import { UserProfileProvider } from "@/components/profile/UserProfileProvider";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import { translate } from "@/i18n";
import { FAB_POSITION_BOOT_SCRIPT } from "@/lib/fab-position";
import { LANGUAGE_BOOT_SCRIPT } from "@/lib/language";
import "./globals.css";

/**
 * The in-IDE browser stamps `data-cursor-ref` onto SSR markup before hydration.
 * React then reports a false mismatch. Strip those attributes in development
 * only, and stop once the page has loaded so later inspection refs can stick.
 */
const DEV_CURSOR_REF_GUARD =
  "(function(){function s(n){if(!n||n.nodeType!==1)return;if(n.hasAttribute('data-cursor-ref'))n.removeAttribute('data-cursor-ref');}function t(n){if(!n||n.nodeType!==1)return;s(n);var a=n.querySelectorAll('[data-cursor-ref]');for(var i=0;i<a.length;i++)a[i].removeAttribute('data-cursor-ref');}t(document.documentElement);var o=new MutationObserver(function(rs){for(var i=0;i<rs.length;i++){var r=rs[i];if(r.type==='attributes')s(r.target);var ns=r.addedNodes;for(var j=0;j<ns.length;j++)t(ns[j]);}});o.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-cursor-ref']});function stop(){t(document.documentElement);o.disconnect();}if(document.readyState==='complete')setTimeout(stop,1500);else window.addEventListener('load',function(){setTimeout(stop,1500);});})();";

/**
 * Cairo is bundled at build time via next/font (self-hosted), so runtime
 * never waits on Google Fonts. Fallbacks stay in --font-wesal-sans.
 */
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-wesal-sans",
  fallback: ["Segoe UI", "Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  title: translate("meta.siteTitle", "ar"),
  description: translate("meta.siteDescription", "ar"),
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }, { url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} font-wesal-sans antialiased`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NODE_ENV === "development" ? (
          <script dangerouslySetInnerHTML={{ __html: DEV_CURSOR_REF_GUARD }} />
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FAB_POSITION_BOOT_SCRIPT }} />
      </head>
      <body className={`${cairo.className} min-h-svh overflow-x-hidden font-sans`}>
        <AuthProvider>
          <AudioPermissionProvider>
            <HallOwnerAudioAlerts />
            <UserProfileProvider>
              <LanguageProvider>
                <MessagesInboxProvider>
                  <NotificationEventsBridge />
                  <AiAssistantProvider>{children}</AiAssistantProvider>
                  <NotificationToastHost />
                  <MessagesInboxPanelHost />
                </MessagesInboxProvider>
              </LanguageProvider>
            </UserProfileProvider>
          </AudioPermissionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
