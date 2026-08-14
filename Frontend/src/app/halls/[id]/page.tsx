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
      <main className="container-wesal w-full min-h-[60svh] overflow-x-hidden py-8 sm:py-12">
        <Suspense fallback={<HallDetailsSkeleton />}>
          <HallDetailsPage hallId={id} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
