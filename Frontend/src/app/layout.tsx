import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-wesal-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "وصال | Wesal",
  description: "منصة حجز قاعات الأفراح في غزة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} antialiased`}>
      <body className={`${cairo.className} min-h-svh overflow-x-hidden font-sans`}>
        {children}
      </body>
    </html>
  );
}
