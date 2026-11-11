import type { Metadata } from "next";
import ProfessionalOffersManagePage from "@/components/offers/ProfessionalOffersManagePage";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.proOffersTitle", "ar"),
  description: translate("meta.proOffersDescription", "ar"),
};

export default function ProfileOffersRoutePage() {
  return <ProfessionalOffersManagePage />;
}
