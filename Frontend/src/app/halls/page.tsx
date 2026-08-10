import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function HallsPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          القاعات
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          صفحة البحث الكامل والفلترة المتقدمة ستُكمَّل في تاسك US-LAND-07.
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
