import type { ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
