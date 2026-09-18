import type { Metadata } from "next";
import SeekerMessagesPage from "@/components/seeker-dashboard/SeekerMessagesPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("seeker.messages.metaTitle", "ar"),
  description: translate("seeker.messages.subtitle", "ar"),
};

export default function SeekerMessagesRoutePage() {
  return <SeekerMessagesPage />;
}
