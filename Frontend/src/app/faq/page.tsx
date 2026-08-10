import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          الأسئلة الشائعة
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          محتوى الأسئلة الشائعة سيُضاف لاحقًا.
        </p>
      </main>
      <Footer />
    </>
  );
}
