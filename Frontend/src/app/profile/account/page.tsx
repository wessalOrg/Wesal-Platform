import type { Metadata } from "next";
import SeekerSettingsPage from "@/components/seeker-dashboard/SeekerSettingsPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.profileTitle", "ar"),
  description: translate("meta.profileDescription", "ar"),
};

/** Merged personal profile + account settings. */
export default function SeekerAccountRoutePage() {
  return <SeekerSettingsPage />;
}
