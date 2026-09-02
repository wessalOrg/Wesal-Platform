import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MessagesInbox from "@/components/messages/MessagesInbox";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.messagesTitle", "ar"),
  description: translate("meta.messagesDescription", "ar"),
};

export default function MessagesIndexPage() {
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-8">
        <MessagesInbox />
      </main>
      <Footer />
    </>
  );
}
