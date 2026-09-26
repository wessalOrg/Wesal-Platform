"use client";

type AdminMessageAvatarProps = {
  name: string;
  size?: "sm" | "md";
  className?: string;
};

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "و";
  return trimmed.charAt(0).toUpperCase();
}

export default function AdminMessageAvatar({
  name,
  size = "md",
  className = "",
}: AdminMessageAvatarProps) {
  const dim = size === "sm" ? "h-10 w-10 text-sm" : "h-11 w-11 text-base";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] font-bold text-[var(--wesal-maroon-dark)] ring-1 ring-[var(--wesal-maroon)]/15 ${dim} ${className}`.trim()}
      aria-hidden="true"
      data-testid="admin-message-avatar"
    >
      {initialOf(name)}
    </span>
  );
}
