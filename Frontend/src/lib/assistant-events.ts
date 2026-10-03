/** Lets any page component open Mabrouk (the floating AI assistant). */
export const OPEN_ASSISTANT_EVENT = "wesal:open-assistant";

export function requestOpenAssistant(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
