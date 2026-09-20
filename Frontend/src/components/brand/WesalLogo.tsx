type WesalLogoProps = {
  className?: string;
  /** brand = original mark, white = inverted for dark surfaces */
  variant?: "brand" | "white";
  title?: string;
};

/**
 * Wesal wordmark — original calligraphy PNG, tinted to site maroon.
 */
export default function WesalLogo({
  className = "h-11 w-auto",
  variant = "brand",
  title = "وِصال",
}: WesalLogoProps) {
  return (
    <span
      className={`wesal-logo wesal-logo--${variant} relative inline-block shrink-0 ${className}`}
      role="img"
      aria-label={title}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img
        src="/logo-wesal.png?v=11"
        alt=""
        draggable={false}
        decoding="async"
        className={`wesal-logo-img wesal-logo-img--${variant}`}
      />
    </span>
  );
}
