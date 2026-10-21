import { splitClockRangeLabel } from "@/lib/hourly-slots";

type StableClockRangeTextProps = {
  label: string;
  className?: string;
};

/**
 * Renders "2:00 م - 6:00 م" without RTL reordering the dash/meridians.
 * Each side is its own LTR span so ص/م stay glued to their digits.
 */
export default function StableClockRangeText({ label, className }: StableClockRangeTextProps) {
  const parts = splitClockRangeLabel(label);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    return (
      <span dir="ltr" className={className}>
        {parts[0]}
      </span>
    );
  }

  return (
    <span dir="ltr" className={className ? `inline-flex items-center gap-1 ${className}` : "inline-flex items-center gap-1"}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? (
            <span className="shrink-0" aria-hidden="true">
              -
            </span>
          ) : null}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </span>
  );
}
