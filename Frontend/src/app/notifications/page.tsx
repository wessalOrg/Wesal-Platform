import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import NotificationsView from "@/components/notifications/NotificationsView";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.notificationsTitle", "ar"),
  description: translate("meta.notificationsDescription", "ar"),
};

export default function NotificationsPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-8">
        <NotificationsView />
      </main>
      <Footer />
    </>
  );
}
