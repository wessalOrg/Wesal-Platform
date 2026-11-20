import type { ReactNode } from "react";

type IconName = "add" | "image" | "document" | "price" | "info" | "send" | "close";

export default function PostEditorIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    add: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 7v10M7 12h10" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m3 16 5-5 5 5 3-3 5 5" /><circle cx="15.5" cy="8.5" r="1.5" /></>,
    document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8m-8 4h6" /></>,
    price: <><path d="M21 3h-8L3 13l8 8L21 11V3Z" /><circle cx="17" cy="7" r="1" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    send: <><path d="m21 3-6 18-4-8-8-4L21 3Zm0 0L11 13" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
