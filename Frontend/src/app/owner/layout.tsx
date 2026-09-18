import type { Metadata } from "next";
import HallOwnerManagementGuard from "@/components/owner-management/HallOwnerManagementGuard";
import HallOwnerManagementShell from "@/components/owner-management/HallOwnerManagementShell";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.ownerManagementTitle", "ar"),
  description: translate("meta.ownerManagementDescription", "ar"),
};

/** App-shell owner portal (same workspace chrome as the seeker dashboard). */
export default function OwnerManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="seeker-app">
      <HallOwnerManagementGuard>
        <HallOwnerManagementShell>{children}</HallOwnerManagementShell>
      </HallOwnerManagementGuard>
    </div>
  );
}
