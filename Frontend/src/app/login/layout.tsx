import type { ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
