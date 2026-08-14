import AuthStubForm from "@/components/auth/AuthStubForm";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type LoginPageProps = {
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect, action } = await searchParams;
  const registerHref = buildAuthAlternateHref("register", redirect, action);

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">
          تسجيل الدخول
        </h1>
        <p className="mt-3 text-[var(--wesal-muted)]">
          {redirect ? (
            <>
              بعد تسجيل الدخول ستُعاد تلقائياً إلى القاعة التي اخترتها
              {action === "book" ? " لمتابعة الحجز" : ""}.
              <span className="mt-1 block text-sm text-[var(--wesal-text)]">
                {decodeURIComponent(redirect)}
              </span>
            </>
          ) : (
            "سجّل الدخول لمتابعة الحجز."
          )}
        </p>
        <AuthStubForm
          mode="login"
          redirectTo={redirect}
          action={action}
          alternateHref={registerHref}
          alternateLabel="ليس لديك حساب؟ إنشاء حساب"
        />
      </main>
      <Footer />
    </>
  );
}
