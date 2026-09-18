type WesalLogoProps = {
  className?: string;
  /** brand = original dusty-rose mark, white = inverted for dark surfaces */
  variant?: "brand" | "white";
  /** Kept for API compatibility; new artwork is static. */
  animated?: boolean;
  title?: string;
};

/**
 * Wesal wordmark — calligraphy + interlocking rings (exact brand artwork).
 */
export default function WesalLogo({
  className = "h-11 w-auto",
  variant = "brand",
  animated = false,
  title = "وصال",
}: WesalLogoProps) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      role="img"
      aria-label={title}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img
        src="/logo-wesal.png?v=2"
        alt=""
        draggable={false}
        className={`wesal-logo-img wesal-logo-img--${variant}${animated ? " wesal-logo-img--pulse" : ""}`}
      />
    </span>
  );
}
