import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MessagesView from "@/components/messages/MessagesView";
import { translate } from "@/i18n";

type MessagesPageProps = {
  params: Promise<{ conversationId: string }>;
};

export const metadata: Metadata = {
  title: translate("meta.messagesTitle", "ar"),
  description: translate("meta.messagesDescription", "ar"),
};

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { conversationId } = await params;
  return (
    <>
      <Navbar />
      <main className="container-wesal min-h-[60svh] py-8">
        <MessagesView conversationId={conversationId} />
      </main>
      <Footer />
    </>
  );
}
