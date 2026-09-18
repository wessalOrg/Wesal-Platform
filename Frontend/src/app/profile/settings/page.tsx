import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SEEKER_ACCOUNT_PATH } from "@/constants/seekerDashboardNav";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.profileTitle", "ar"),
  description: translate("meta.profileDescription", "ar"),
};

/** Settings merged into personal profile. */
export default function SeekerSettingsRoutePage() {
  redirect(SEEKER_ACCOUNT_PATH);
}
