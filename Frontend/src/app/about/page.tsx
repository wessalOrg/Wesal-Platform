import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">من نحن</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--wesal-muted)]">
          وصال منصة لحجز قاعات الأفراح في غزة، تهدف لتسهيل البحث والمقارنة
          والتواصل مع أصحاب القاعات بطريقة أنيقة وواضحة.
        </p>
        <Link href="/" className="btn-outline mt-8">
          العودة للرئيسية
        </Link>
      </main>
      <Footer />
    </>
  );
}
