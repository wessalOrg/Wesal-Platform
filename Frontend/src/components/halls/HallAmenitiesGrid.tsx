type HallAmenitiesGridProps = {
  amenities: string[];
};

export default function HallAmenitiesGrid({ amenities }: HallAmenitiesGridProps) {
  if (!amenities.length) return null;

  return (
    <section aria-labelledby="hall-amenities-heading" data-testid="hall-amenities">
      <h2
        id="hall-amenities-heading"
        className="text-lg font-bold text-[var(--wesal-maroon)] sm:text-xl"
      >
        المرافق والخدمات
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {amenities.map((amenity) => (
          <li
            key={amenity}
            className="flex items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-3 py-2.5 text-sm font-medium text-[var(--wesal-text)]"
          >
            <CheckIcon />
            <span>{amenity}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
