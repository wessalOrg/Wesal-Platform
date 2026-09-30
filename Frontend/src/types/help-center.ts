export const HELP_CENTER_STORAGE_KEY = "wesal_help_center_v1";
export const HELP_CONVERSATION_PREFIX = "help-";
export const HELP_CENTER_HALL_ID = "help-center";
export const WESAL_TEAM_SENDER_ID = "wesal-team";
export const HELP_CENTER_MAX_LENGTH = 1000;
export const HELP_CENTER_CHANGE_EVENT = "wesal-help-center-changed";

export type HelpTicketStatus = "open" | "replied";

export type HelpTicket = {
  id: string;
  userId: string;
  userName: string;
  question: string;
  createdAt: string;
  status: HelpTicketStatus;
  reply: string | null;
  repliedAt: string | null;
  /** User has not opened the Wesal Team thread since the last admin reply. */
  userUnread: boolean;
};

export type HelpCenterStore = {
  version: 1;
  tickets: HelpTicket[];
};

export function isHelpConversationId(conversationId: string | null | undefined): boolean {
  return Boolean(conversationId?.startsWith(HELP_CONVERSATION_PREFIX));
}

export function helpConversationId(ticketId: string): string {
  return `${HELP_CONVERSATION_PREFIX}${ticketId}`;
}

export function ticketIdFromConversationId(conversationId: string): string | null {
  if (!isHelpConversationId(conversationId)) return null;
  return conversationId.slice(HELP_CONVERSATION_PREFIX.length) || null;
}
