import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-wesal-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "وصال | Wesal",
  description: "منصة حجز قاعات الأفراح في غزة",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className={`${cairo.className} flex min-h-full flex-col font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
