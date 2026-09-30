import { LogLevel, type ILogger } from "@microsoft/signalr";

function serverUnreachable(message: string): boolean {
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ERR_CONNECTION_REFUSED")
  );
}

/**
 * SignalR logs a failed hub handshake with console.error even when the caller
 * already treats the socket as optional. A closed API is that case: REST still
 * works, and the dev overlay should not treat it as an application error.
 * Auth, protocol, and other hub failures still surface.
 */
export const realtimeLogger: ILogger = {
  log(level, message) {
    if (level < LogLevel.Warning) return;
    if (serverUnreachable(message)) return;
    if (level >= LogLevel.Error) {
      console.error(message);
      return;
    }
    console.warn(message);
  },
};
