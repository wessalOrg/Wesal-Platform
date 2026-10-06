import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { AiAssistantProvider } from "@/components/assistant/AiAssistantProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import HallOwnerAudioAlerts from "@/components/halls/notifications/HallOwnerAudioAlerts";
import NotificationEventsBridge from "@/components/notifications/NotificationEventsBridge";
import NotificationToastHost from "@/components/notifications/NotificationToastHost";
import PwaInstallBanner from "@/components/pwa/PwaInstallBanner";
import PwaRegister from "@/components/pwa/PwaRegister";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "وصال",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon.png", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#c17b7f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FAB_POSITION_BOOT_SCRIPT }} />
        {/* Legacy iOS (< 15) needs the apple- prefixed tags; modern
            browsers use mobile-web-app-capable emitted via metadata. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="وصال" />
      </head>
      <body className={`${cairo.className} min-h-svh overflow-x-hidden font-sans`}>
        <PwaRegister />
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
                  <PwaInstallBanner />
                </MessagesInboxProvider>
              </LanguageProvider>
            </UserProfileProvider>
          </AudioPermissionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
