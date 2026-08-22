import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import { translate } from "@/i18n";
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
      </head>
      <body className={`${cairo.className} min-h-svh overflow-x-hidden font-sans`}>
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
