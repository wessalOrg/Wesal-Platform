import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AiAssistantProvider } from "@/components/assistant/AiAssistantProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import HallOwnerAudioAlerts from "@/components/halls/notifications/HallOwnerAudioAlerts";
import { AudioPermissionProvider } from "@/hooks/useAudioPermission";
import MessagesInboxPanelHost from "@/components/messages/MessagesInboxPanelHost";
import { MessagesInboxProvider } from "@/components/messages/MessagesInboxProvider";
import { UserProfileProvider } from "@/components/profile/UserProfileProvider";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import { translate } from "@/i18n";
import { FAB_POSITION_BOOT_SCRIPT } from "@/lib/fab-position";
import { LANGUAGE_BOOT_SCRIPT } from "@/lib/language";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-wesal-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  preload: true,
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
    <html lang="ar" dir="rtl" className={`${cairo.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FAB_POSITION_BOOT_SCRIPT }} />
      </head>
      <body className={`${cairo.variable} ${cairo.className} min-h-svh overflow-x-hidden font-sans`}>
        <AuthProvider>
          <AudioPermissionProvider>
            <HallOwnerAudioAlerts />
            <UserProfileProvider>
              <LanguageProvider>
                <MessagesInboxProvider>
                  <AiAssistantProvider>{children}</AiAssistantProvider>
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
