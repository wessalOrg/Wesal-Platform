import ResetPasswordScreen from "@/components/auth/ResetPasswordScreen";

type ResetPasswordPageProps = {
  searchParams: Promise<{ email?: string; token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { email, token } = await searchParams;
  const hasEmail = typeof email === "string" && email.trim().length > 0;
  const hasToken = typeof token === "string" && token.trim().length > 0;

  return (
    <ResetPasswordScreen
      email={hasEmail ? email : undefined}
      token={hasToken ? token : undefined}
      invalidLink={!hasEmail || !hasToken}
    />
  );
}