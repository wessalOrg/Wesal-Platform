import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          تسجيل الدخول
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          شاشة الدخول ستُبنى في Epic 5.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
        >
          إنشاء حساب
        </Link>
      </main>
      <Footer />
    </>
  );
}
