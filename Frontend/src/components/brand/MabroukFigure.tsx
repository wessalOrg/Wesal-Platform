"use client";

export type MabroukPose =
  | "favoritesEmpty"
  | "removeConfirm"
  | "messageEmpty"
  | "offline"
  | "sendFail"
  | "confirmWarning";

const MABROUK_SRC: Record<MabroukPose, string> = {
  favoritesEmpty: "/assistant/mabrouk-favorites-empty.jpg",
  removeConfirm: "/assistant/mabrouk-ask.jpg",
  messageEmpty: "/assistant/mabrouk-message-empty.jpg",
  offline: "/assistant/mabrouk-offline-wifi.jpg",
  sendFail: "/assistant/mabrouk-send-fail.jpg",
  confirmWarning: "/assistant/mabrouk-confirm-warning.jpg",
};

/** Poses that include props (heart box, wifi, marks) — avoid cover-crop clipping. */
const SCENE_POSES: ReadonlySet<MabroukPose> = new Set([
  "favoritesEmpty",
  "messageEmpty",
  "offline",
  "sendFail",
  "confirmWarning",
  "removeConfirm",
]);

type MabroukFigureProps = {
  pose: MabroukPose;
  /** Visual size of the figure container. */
  size?: "sm" | "md" | "lg";
  className?: string;
  rounded?: "full" | "2xl" | "none";
};

const SIZE_CLASS: Record<NonNullable<MabroukFigureProps["size"]>, string> = {
  sm: "h-16 w-16",
  md: "h-28 w-28 sm:h-32 sm:w-32",
  lg: "h-36 w-36 sm:h-40 sm:w-40",
};

const ROUND_CLASS: Record<NonNullable<MabroukFigureProps["rounded"]>, string> = {
  full: "rounded-full",
  "2xl": "rounded-[1.75rem]",
  none: "rounded-none",
};

/**
 * Brand character illustration for empty states and confirmation dialogs.
 * Decorative only — keep surrounding copy and actions unchanged.
 *
 * Poses map to design scenes:
 * - favoritesEmpty: pointing at empty-favorite heart box
 * - removeConfirm: question-mark pose (pair with trash affordance in host UI)
 * - messageEmpty: resting on / beside message card
 * - offline: sad beside broken wifi / cloud
 * - sendFail: exclamation / fail gesture
 * - confirmWarning: caution pose for stop / moderation confirms
 */
export default function MabroukFigure({
  pose,
  size = "md",
  className = "",
  rounded = "full",
}: MabroukFigureProps) {
  const isScene = SCENE_POSES.has(pose);
  const fitClass = isScene ? "object-contain" : "object-cover";
  const toneClass = className.includes("bg-transparent")
    ? ""
    : "bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)]";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${toneClass} ${SIZE_CLASS[size]} ${ROUND_CLASS[rounded]} ${className}`.trim()}
      aria-hidden="true"
      data-testid={`mabrouk-figure-${pose}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- brand illustration asset */}
      <img
        src={MABROUK_SRC[pose]}
        alt=""
        width={320}
        height={320}
        className={`h-full w-full object-center ${fitClass}`}
        draggable={false}
      />
    </span>
  );
}
