import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProfileView from "@/components/profile/ProfileView";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.profileTitle", "ar"),
  description: translate("meta.profileDescription", "ar"),
};

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-8">
        <ProfileView />
      </main>
      <Footer />
    </>
  );
}
