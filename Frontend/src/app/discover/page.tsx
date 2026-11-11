import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoverPageView from "@/components/discover/DiscoverPageView";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.discoverTitle", "ar"),
  description: translate("meta.discoverDescription", "ar"),
};

export default function DiscoverPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[60svh] bg-[var(--wesal-cream)]">
        <Suspense
          fallback={
            <div className="container-wesal py-16 text-center text-sm text-[var(--wesal-muted)]">
              {translate("discover.searching", "ar")}
            </div>
          }
        >
          <DiscoverPageView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
