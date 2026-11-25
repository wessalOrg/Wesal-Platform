import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PostsAndOffersView from "@/components/community/PostsAndOffersView";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("community.title", "ar"),
  description: translate("community.subtitle", "ar"),
};

export default function PostsAndOffersPage() {
  return <><Navbar /><main className="community-page"><PostsAndOffersView /></main><Footer /></>;
}
