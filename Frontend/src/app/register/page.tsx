import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          إنشاء حساب
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          شاشة التسجيل ستُبنى في Epic 4.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
        >
          لديك حساب؟ سجّل الدخول
        </Link>
      </main>
      <Footer />
    </>
  );
}
