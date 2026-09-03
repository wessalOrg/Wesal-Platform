import { isSameUserId } from "@/lib/current-user";
import type { ThreadMessage } from "@/types/messages";

function mergeMessage(current: ThreadMessage, incoming: ThreadMessage): ThreadMessage {
  return {
    ...current,
    ...incoming,
    senderName: incoming.senderName.trim() || current.senderName,
    senderUserId: incoming.senderUserId || current.senderUserId,
    clientRequestId: current.clientRequestId ?? incoming.clientRequestId,
    delivery: incoming.delivery ?? current.delivery ?? "sent",
  };
}

export function sortThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return [...messages].sort((left, right) => {
    const time = Date.parse(left.sentAt) - Date.parse(right.sentAt);
    if (time !== 0) return time;
    return left.id.localeCompare(right.id);
  });
}

export function upsertThreadMessage(messages: ThreadMessage[], incoming: ThreadMessage): ThreadMessage[] {
  const byId = messages.findIndex((item) => item.id === incoming.id);
  if (byId >= 0) {
    const next = [...messages];
    next[byId] = mergeMessage(messages[byId], incoming);
    return sortThreadMessages(next);
  }

  if (incoming.clientRequestId) {
    const byClient = messages.findIndex((item) => item.clientRequestId === incoming.clientRequestId);
    if (byClient >= 0) {
      const next = [...messages];
      next[byClient] = mergeMessage(messages[byClient], incoming);
      return sortThreadMessages(next);
    }
  }

  const pendingMatch = messages.findIndex(
    (item) =>
      (item.delivery === "pending" || item.delivery === "failed") &&
      isSameUserId(item.senderUserId, incoming.senderUserId) &&
      item.content === incoming.content,
  );
  if (pendingMatch >= 0) {
    const next = [...messages];
    next[pendingMatch] = mergeMessage(messages[pendingMatch], incoming);
    return sortThreadMessages(next);
  }

  return sortThreadMessages([...messages, incoming]);
}

export function mergeServerMessages(
  server: ThreadMessage[],
  extras: ThreadMessage[],
): ThreadMessage[] {
  let next = server.map((item) => ({ ...item, delivery: item.delivery ?? ("sent" as const) }));
  for (const extra of extras) {
    next = upsertThreadMessage(next, extra);
  }
  return next;
}

export function localsStillOpen(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.filter((item) => item.delivery === "pending" || item.delivery === "failed");
}
