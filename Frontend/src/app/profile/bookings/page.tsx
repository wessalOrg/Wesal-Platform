import type { Metadata } from "next";
import SeekerBookingsPage from "@/components/seeker-dashboard/SeekerBookingsPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.seekerBookingsTitle", "ar"),
  description: translate("meta.seekerBookingsDescription", "ar"),
};

export default function SeekerBookingsRoutePage() {
  return <SeekerBookingsPage />;
}
