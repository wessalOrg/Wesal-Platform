import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; intent?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirect = params.redirect ?? "";
  const intent = params.intent ?? "";
  const isContactIntent = intent === "contact";
  const loginHint = isContactIntent
    ? "بعد تسجيل الدخول تقدر تفتحي محادثة مع صاحب القاعة."
    : "شاشة الدخول ستُبنى في Epic 5.";
  const registerHref = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}${intent ? `&intent=${encodeURIComponent(intent)}` : ""}`
    : "/register";

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          تسجيل الدخول
        </h1>
        <p className="mt-3 max-w-xl text-[var(--wesal-muted)] leading-8">{loginHint}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {isContactIntent && redirect.startsWith("/") ? (
            <Link
              href={redirect}
              className="inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
            >
              العودة لتفاصيل القاعة
            </Link>
          ) : null}
          <Link
            href={registerHref}
            className="inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
          >
            إنشاء حساب
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
