import RegisterAccountTypeScreen from "@/components/auth/RegisterAccountTypeScreen";
import {
  resolveInitialAccountType,
  type AccountType,
} from "@/lib/account-type";

type RegisterPageProps = {
  searchParams: Promise<{
    redirect?: string;
    action?: string;
    intent?: string;
    type?: string;
    accountType?: string;
    previewSuccess?: string;
  }>;
};

function resolveAuthAction(action?: string, intent?: string) {
  if (action) return action;
  if (intent === "book" || intent === "contact") return intent;
  return undefined;
}

function buildLoginHref(redirect?: string, action?: string): string {
  if (!redirect) return "/login";
  const params = new URLSearchParams({ redirect });
  if (action) params.set("action", action);
  return `/login?${params.toString()}`;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { redirect, action, intent, type, accountType, previewSuccess } = await searchParams;
  const resolvedAction = resolveAuthAction(action, intent);
  const loginHref = buildLoginHref(redirect, resolvedAction);
  const initialAccountType: AccountType | null = resolveInitialAccountType({
    accountType,
    type,
  });

  return (
    <RegisterAccountTypeScreen
      initialAccountType={initialAccountType}
      loginHref={loginHref}
      previewSuccess={previewSuccess === "1" || previewSuccess === "true"}
    />
  );
}
