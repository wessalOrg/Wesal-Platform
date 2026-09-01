type AiAssistantAvatarProps = {
  className?: string;
  pose?: "bust" | "full";
};

const SRC = {
  bust: "/assistant/wesal-ai-groom.png",
  full: "/assistant/wesal-ai-groom-full.png?v=2",
} as const;

/** Illustrated Wesal AI host — a drawn mascot, not a photo cutout. */
export default function AiAssistantAvatar({
  className,
  pose = "bust",
}: AiAssistantAvatarProps) {
  const isFull = pose === "full";
  return (
    // Decorative; the parent control already names the assistant.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[pose]}
      alt=""
      draggable={false}
      className={
        className ??
        (isFull ? "h-full w-full object-contain object-bottom" : "h-full w-full object-cover")
      }
    />
  );
}
