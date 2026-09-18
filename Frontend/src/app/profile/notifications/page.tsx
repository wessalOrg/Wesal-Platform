import type { Metadata } from "next";
import SeekerNotificationsPage from "@/components/seeker-dashboard/SeekerNotificationsPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("seeker.notifications.metaTitle", "ar"),
  description: translate("seeker.notifications.subtitle", "ar"),
};

export default function SeekerNotificationsRoutePage() {
  return <SeekerNotificationsPage />;
}
