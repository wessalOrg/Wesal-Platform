import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type RegisterPageProps = {
  searchParams: Promise<{ redirect?: string; intent?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const redirect = params.redirect ?? "";
  const intent = params.intent ?? "";
  const hallMatch = redirect.match(/\/halls\/([^/?#]+)/);
  const hallId = hallMatch?.[1] ?? "";
  const isBookIntent = intent === "book" && Boolean(hallId);
  const isContactIntent = intent === "contact" && Boolean(hallId);

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          إنشاء حساب
        </h1>
        {isBookIntent ? (
          <p className="mt-3 max-w-xl text-[var(--wesal-muted)] leading-8">
            بعد إنشاء الحساب رح نرجّعك لتفاصيل القاعة المختارة لإكمال الحجز.
          </p>
        ) : isContactIntent ? (
          <p className="mt-3 max-w-xl text-[var(--wesal-muted)] leading-8">
            بعد إنشاء الحساب رح نرجّعك لتفاصيل القاعة للتواصل مع صاحبها.
          </p>
        ) : (
          <p className="mt-3 text-[var(--wesal-muted)]">
            شاشة التسجيل ستُبنى في Epic 4.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {isBookIntent || isContactIntent ? (
            <Link
              href={redirect.startsWith("/") ? redirect : `/halls/${hallId}`}
              className="inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
            >
              العودة لتفاصيل القاعة
            </Link>
          ) : null}
          <Link
            href={
              redirect
                ? `/login?redirect=${encodeURIComponent(redirect)}${intent ? `&intent=${encodeURIComponent(intent)}` : ""}`
                : "/login"
            }
            className="inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
          >
            لديك حساب؟ سجّل الدخول
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
