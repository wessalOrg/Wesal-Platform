type IconName = "tag" | "all" | "active" | "scheduled" | "expired" | "stopped" | "view" | "edit" | "more";

export default function OfferManageIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    tag: <><path d="M20 3h-7L3 13l8 8L21 11V4a1 1 0 0 0-1-1Z" /><circle cx="17" cy="7" r="1" /></>,
    all: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    active: <><path d="M7 3h10v18H7zM10 8l5 4-5 4V8Z" /><path d="M10 3V1m4 2V1" /></>,
    scheduled: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m2 3h3" /></>,
    expired: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
    stopped: <><circle cx="12" cy="12" r="9" /><path d="M9 8v8m6-8v8" /></>,
    view: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    edit: <><path d="m15 4 5 5M4 16l-1 5 5-1L21 7a2 2 0 0 0-5-5L4 16Z" /></>,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
