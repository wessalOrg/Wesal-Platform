import { t } from "@/i18n";
import {
  HELP_CENTER_HALL_ID,
  WESAL_TEAM_SENDER_ID,
  helpConversationId,
  type HelpTicket,
} from "@/types/help-center";
import type { ConversationSummary, MessageThread } from "@/types/messages";

export function wesalTeamDisplayName(): string {
  return t("help.wesalTeam");
}

export function helpTicketToConversationSummary(ticket: HelpTicket): ConversationSummary {
  const repliedAt = ticket.repliedAt ?? ticket.createdAt;
  return {
    conversationId: helpConversationId(ticket.id),
    hallId: HELP_CENTER_HALL_ID,
    hallName: "",
    otherParticipantId: WESAL_TEAM_SENDER_ID,
    otherParticipantName: wesalTeamDisplayName(),
    lastMessagePreview: (ticket.reply ?? ticket.question).trim(),
    lastMessageAt: repliedAt,
    messageCount: ticket.reply ? 2 : 1,
    createdAt: ticket.createdAt,
    isUnread: ticket.userUnread,
  };
}

export function helpTicketToMessageThread(ticket: HelpTicket): MessageThread {
  const messages = [
    {
      id: `${ticket.id}-q`,
      senderUserId: ticket.userId,
      senderName: ticket.userName,
      content: ticket.question,
      sentAt: ticket.createdAt,
      delivery: "sent" as const,
    },
  ];

  if (ticket.reply && ticket.repliedAt) {
    messages.push({
      id: `${ticket.id}-a`,
      senderUserId: WESAL_TEAM_SENDER_ID,
      senderName: wesalTeamDisplayName(),
      content: ticket.reply,
      sentAt: ticket.repliedAt,
      delivery: "sent",
    });
  }

  return {
    conversationId: helpConversationId(ticket.id),
    hallId: HELP_CENTER_HALL_ID,
    hallName: "",
    messages,
  };
}
