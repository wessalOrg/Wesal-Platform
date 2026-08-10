type WesalLogoProps = {
  className?: string;
  /** brand = animated colors inside mark, white = light version */
  variant?: "brand" | "white";
  title?: string;
};

/**
 * Exact Wesal logo — animated gradient INSIDE the silhouette.
 * Keeps the original artwork (clef + rings).
 */
export default function WesalLogo({
  className = "h-10 w-10",
  variant = "brand",
  title = "وصال",
}: WesalLogoProps) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden ${className}`}
      role="img"
      aria-label={title}
      title={title}
    >
      <span
        className={`wesal-logo-mark wesal-logo-${variant}`}
        aria-hidden="true"
      />
    </span>
  );
}
