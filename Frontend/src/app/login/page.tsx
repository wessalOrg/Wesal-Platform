import AuthStubForm from "@/components/auth/AuthStubForm";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; action?: string; intent?: string }>;
};

function resolveAuthAction(action?: string, intent?: string) {
  if (action) return action;
  if (intent === "book" || intent === "contact") return intent;
  return undefined;
}

function actionCopy(action?: string) {
  if (action === "book") return " لمتابعة الحجز";
  if (action === "contact") return " للتواصل مع صاحب القاعة";
  return "";
}

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
  const { redirect, action, intent } = await searchParams;
  const resolvedAction = resolveAuthAction(action, intent);
  const registerHref = buildAuthAlternateHref("register", redirect, resolvedAction);

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
              {actionCopy(resolvedAction)}.
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
          action={resolvedAction}
          alternateHref={registerHref}
          alternateLabel="ليس لديك حساب؟ إنشاء حساب"
        />
      </main>
      <Footer />
    </>
  );
}
