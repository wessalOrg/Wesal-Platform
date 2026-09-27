"use client";

import MessagesInbox from "@/components/messages/MessagesInbox";

type MessagesViewProps = {
  conversationId: string;
};

export default function MessagesView({ conversationId }: MessagesViewProps) {
  return <MessagesInbox initialConversationId={conversationId} />;
}
