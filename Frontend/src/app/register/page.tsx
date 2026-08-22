import AuthPageCopy from "@/components/auth/AuthPageCopy";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type RegisterPageProps = {
  searchParams: Promise<{ redirect?: string; action?: string; intent?: string }>;
};

function resolveAuthAction(action?: string, intent?: string) {
  if (action) return action;
  if (intent === "book" || intent === "contact") return intent;
  return undefined;
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

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { redirect, action, intent } = await searchParams;
  const resolvedAction = resolveAuthAction(action, intent);
  const loginHref = buildAuthAlternateHref("login", redirect, resolvedAction);

  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-12">
        <AuthPageCopy
          mode="register"
          redirect={redirect}
          action={resolvedAction}
          alternateHref={loginHref}
        />
      </main>
      <Footer />
    </>
  );
}
