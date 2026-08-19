import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HallsCatalogView from "@/components/halls/HallsCatalogView";

export const metadata: Metadata = {
  title: "القاعات | وصال",
  description: "تصفح كل قاعات الأفراح المعتمدة على منصة وصال.",
};

export default function HallsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[60svh] bg-[var(--wesal-cream)]">
        <Suspense
          fallback={
            <div className="container-wesal py-10 text-sm text-[var(--wesal-muted)]">
              جاري تحميل القاعات…
            </div>
          }
        >
          <HallsCatalogView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
