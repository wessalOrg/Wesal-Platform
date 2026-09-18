import type { Metadata } from "next";
import AdminManagementGuard from "@/components/admin/AdminManagementGuard";
import AdminManagementShell from "@/components/admin/AdminManagementShell";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.adminManagementTitle", "ar"),
  description: translate("meta.adminManagementDescription", "ar"),
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seeker-app">
      <AdminManagementGuard>
        <AdminManagementShell>{children}</AdminManagementShell>
      </AdminManagementGuard>
    </div>
  );
}
