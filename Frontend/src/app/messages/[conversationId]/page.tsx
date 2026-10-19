import { Suspense } from "react";
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
        <Suspense
          fallback={
            <div className="h-72 animate-pulse rounded-[1.4rem] bg-white/80" aria-busy="true" />
          }
        >
          <MessagesView conversationId={conversationId} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
