type HallsNavIconProps = {
  className?: string;
};

/**
 * Vector clone of the hall mark: gable + fleur, draped arch with chandelier,
 * arched side windows, and stepped base. Uses currentColor (no raster image).
 */
export default function HallsNavIcon({ className = "h-5 w-5" }: HallsNavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Steps */}
      <path
        d="M3.5 20.55h17M4.6 18.85h14.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Left wing */}
      <rect
        x="3.35"
        y="10.1"
        width="5.15"
        height="8.2"
        rx="0.35"
        stroke="currentColor"
        strokeWidth="1.45"
      />
      <path
        d="M4.7 16.9V12.55a1.4 1.4 0 0 1 2.8 0V16.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6.1 12.35v4.55M4.7 14.55h2.8"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />

      {/* Right wing */}
      <rect
        x="15.5"
        y="10.1"
        width="5.15"
        height="8.2"
        rx="0.35"
        stroke="currentColor"
        strokeWidth="1.45"
      />
      <path
        d="M16.85 16.9V12.55a1.4 1.4 0 0 1 2.8 0V16.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M18.25 12.35v4.55M16.85 14.55h2.8"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />

      {/* Center pavilion + roof */}
      <path
        d="M7.9 18.3V9.55L12 4.55l4.1 5V18.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Fleur-de-lis */}
      <path
        d="M12 5.85c-.7.45-.95 1.05-.55 1.55.25.3.55.4.55.4s.3-.1.55-.4c.4-.5.15-1.1-.55-1.55Z"
        fill="currentColor"
      />
      <path
        d="M12 6.7v1.15"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />

      {/* Main arch */}
      <path
        d="M9 18V12.2a3 3 0 0 1 6 0V18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Curtains */}
      <path
        d="M9.25 12.35c.65 1.25.8 2.7.6 4.35M14.75 12.35c-.65 1.25-.8 2.7-.6 4.35"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M9.3 12.2c.8.4 1.6.4 2.7.05 1.1.35 1.9.35 2.7-.05"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Chandelier */}
      <circle cx="12" cy="11.15" r="0.5" fill="currentColor" />
      <path
        d="M12 11.55v2.4M10.4 14.85l1.6-.95 1.6.95M10.55 15.7h2.9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
