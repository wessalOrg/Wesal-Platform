import type { Metadata } from "next";
import HallOwnerOffersPage from "@/components/offers/HallOwnerOffersPage";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.ownerOffersTitle", "ar"),
  description: translate("meta.ownerOffersDescription", "ar"),
};

export default function OwnerOffersRoutePage() {
  return <HallOwnerOffersPage />;
}
