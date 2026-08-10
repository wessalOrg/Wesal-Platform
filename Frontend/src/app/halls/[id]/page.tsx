import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type HallDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function HallDetailsPage({ params }: HallDetailsPageProps) {
  const { id } = await params;

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          تفاصيل القاعة
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          معرّف القاعة: {id}. صفحة التفاصيل الكاملة ستُبنى في US-LAND-04.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
        >
          العودة للرئيسية
        </Link>
      </main>
      <Footer />
    </>
  );
}
