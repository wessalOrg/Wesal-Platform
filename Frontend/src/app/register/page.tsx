import AuthStubForm from "@/components/auth/AuthStubForm";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type RegisterPageProps = {
  searchParams: Promise<{ redirect?: string; action?: string }>;
};

function buildAuthAlternateHref(
  target: "login" | "register",
  redirect?: string,
  action?: string,
): string {
  if (!redirect) return target === "login" ? "/login" : "/register";

  const params = new URLSearchParams({ redirect });
  if (action) params.set("action", action);
  return `/${target}?${params.toString()}`;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { redirect, action } = await searchParams;
  const loginHref = buildAuthAlternateHref("login", redirect, action);

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          إنشاء حساب
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          {redirect ? (
            <>
              بعد إنشاء الحساب ستُعاد تلقائياً إلى القاعة التي اخترتها
              {action === "book" ? " لمتابعة الحجز" : ""}.
              <span className="mt-1 block text-sm text-[var(--wesal-text)]">
                {decodeURIComponent(redirect)}
              </span>
            </>
          ) : (
            "أنشئ حساباً جديداً للبدء بالحجز."
          )}
        </p>
        <AuthStubForm
          mode="register"
          redirectTo={redirect}
          action={action}
          alternateHref={loginHref}
          alternateLabel="لديك حساب؟ سجّل الدخول"
        />
      </main>
      <Footer />
    </>
  );
}
