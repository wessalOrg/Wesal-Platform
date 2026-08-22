import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HallsCatalogView from "@/components/halls/HallsCatalogView";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.hallsTitle", "ar"),
  description: translate("meta.hallsDescription", "ar"),
};

export default function HallsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[60svh] bg-[var(--wesal-cream)]">
        <Suspense
          fallback={
            <div className="container-wesal py-10 text-sm text-[var(--wesal-muted)]">
              {translate("halls.catalog.loading", "ar")}
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
