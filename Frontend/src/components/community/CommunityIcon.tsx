import type { ReactNode } from "react";

type Icon = "layers" | "tag" | "image" | "arrow" | "eye" | "comment" | "person";
const paths: Record<Icon, ReactNode> = {
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5Z" /><path d="m2 12 10 5 10-5M2 16l10 5 10-5" /></>,
  tag: <><path d="M20 3h-7L3 13l8 8L21 11V4a1 1 0 0 0-1-1Z" /><circle cx="17" cy="7" r="1" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
  arrow: <path d="m14 5-7 7 7 7" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  comment: <path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z" />,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
};

export default function CommunityIcon({ name }: { name: Icon }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
