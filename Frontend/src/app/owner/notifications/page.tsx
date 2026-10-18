import type { Metadata } from "next";
import OwnerNotificationsPage from "@/components/owner-management/OwnerNotificationsPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.notificationsTitle", "ar"),
  description: translate("owner.notifications.feedSubtitle", "ar"),
};

export default function OwnerNotificationsRoutePage() {
  return <OwnerNotificationsPage />;
}
