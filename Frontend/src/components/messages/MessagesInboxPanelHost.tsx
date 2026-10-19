"use client";

import dynamic from "next/dynamic";
import IncomingMessageAlert from "@/hooks/useIncomingMessageAlert";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";

const MessagesInboxPanel = dynamic(() => import("./MessagesInboxPanel"), {
  ssr: false,
});

/** Mount the floating inbox panel only while open (code-split). */
export default function MessagesInboxPanelHost() {
  const { isOpen } = useMessagesInbox();
  return (
    <>
      <IncomingMessageAlert />
      {isOpen ? <MessagesInboxPanel /> : null}
    </>
  );
}
