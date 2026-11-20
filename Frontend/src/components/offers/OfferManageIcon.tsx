import { useId } from "react";

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

/** Decorative camera, drawn locally so the banner never depends on an external image. */
export function OfferBannerCamera() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="pro-offers-camera" viewBox="0 0 300 190" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="80" y1="35" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop stopColor="#9a8580" /><stop offset=".45" stopColor="#504542" /><stop offset="1" stopColor="#b39b94" /></linearGradient>
        <radialGradient id={`${id}-lens`}><stop stopColor="#201d22" /><stop offset=".38" stopColor="#4f4650" /><stop offset=".55" stopColor="#241f24" /><stop offset=".7" stopColor="#95847e" /><stop offset=".83" stopColor="#3e3432" /><stop offset="1" stopColor="#a18a81" /></radialGradient>
        <linearGradient id={`${id}-shine`} x2="1" y2="1"><stop stopColor="white" stopOpacity=".7" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
      </defs>
      <ellipse cx="155" cy="165" rx="112" ry="12" fill="#a88c83" opacity=".16" />
      <g transform="rotate(8 150 100)">
        <path d="M45 58q0-9 10-9h45l13-19h47l13 19h62q10 0 10 10v87q0 10-11 10H56q-11 0-11-11Z" fill={`url(#${id}-body)`} />
        <path d="M50 79h186v53H50Z" fill="#403734" opacity=".45" />
        <rect x="58" y="38" width="34" height="14" rx="4" fill="#95827b" />
        <rect x="119" y="28" width="39" height="8" rx="3" fill="#b4a29b" />
        <rect x="118" y="42" width="39" height="9" rx="2" fill="#443a37" />
        <path d="M52 58h183" stroke="#d4c1b8" strokeOpacity=".65" strokeWidth="2" />
        <circle cx="169" cy="106" r="57" fill="#685750" /><circle cx="169" cy="106" r="51" fill={`url(#${id}-lens)`} />
        <circle cx="169" cy="106" r="38" stroke="#c9b6aa" strokeOpacity=".55" strokeWidth="2" />
        <circle cx="169" cy="106" r="29" fill="#322b32" /><circle cx="169" cy="106" r="20" fill="#645867" />
        <ellipse cx="160" cy="96" rx="12" ry="17" transform="rotate(40 160 96)" fill={`url(#${id}-shine)`} />
        <circle cx="71" cy="69" r="7" fill="#cab8ac" /><circle cx="217" cy="61" r="3" fill="#ebd8cc" />
      </g>
    </svg>
  );
}
