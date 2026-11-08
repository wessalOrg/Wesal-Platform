import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProfessionalPublicProfileView from "@/components/professionals/ProfessionalPublicProfileView";

type ProfessionalProfileRouteProps = {
  params: Promise<{ userId: string }>;
};

export default async function ProfessionalProfileRoute({
  params,
}: ProfessionalProfileRouteProps) {
  const { userId } = await params;
  const decoded = decodeURIComponent(userId);

  return (
    <>
      <Navbar />
      <main className="w-full min-h-[60svh] overflow-x-hidden bg-[var(--wesal-pink-soft)] py-6 sm:py-10">
        <div className="container-wesal">
          <Suspense
            fallback={
              <div
                className="min-h-[28rem] animate-pulse rounded-3xl bg-white/70"
                aria-busy="true"
              />
            }
          >
            <ProfessionalPublicProfileView userId={decoded} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
