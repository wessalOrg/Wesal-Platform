import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HallDetailsPage from "@/components/halls/HallDetailsPage";
import HallDetailsSkeleton from "@/components/halls/HallDetailsSkeleton";

type HallDetailsRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function HallDetailsRoute({ params }: HallDetailsRouteProps) {
  const { id } = await params;

  return (
    <>
      <Navbar />
      <main className="w-full min-h-[60svh] overflow-x-hidden bg-[var(--wesal-pink-soft)] py-6 sm:py-10">
        <div className="container-wesal">
          <Suspense fallback={<HallDetailsSkeleton />}>
            <HallDetailsPage hallId={id} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
