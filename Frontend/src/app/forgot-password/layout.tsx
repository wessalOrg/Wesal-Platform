import type { ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return <AuthShell testId="forgot-password-shell">{children}</AuthShell>;
}