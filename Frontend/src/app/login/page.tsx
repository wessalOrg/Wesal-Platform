import LoginScreen from "@/components/auth/LoginScreen";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; action?: string; intent?: string }>;
};

function resolveAuthAction(action?: string, intent?: string) {
  if (action) return action;
  if (intent === "book" || intent === "contact") return intent;
  return undefined;
}

function buildRegisterHref(redirect?: string, action?: string): string {
  if (!redirect) return "/register";
  const params = new URLSearchParams({ redirect });
  if (action) params.set("action", action);
  return `/register?${params.toString()}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect, action, intent } = await searchParams;
  const resolvedAction = resolveAuthAction(action, intent);
  const registerHref = buildRegisterHref(redirect, resolvedAction);

  return (
    <LoginScreen
      registerHref={registerHref}
      redirect={redirect}
      action={resolvedAction}
    />
  );
}
