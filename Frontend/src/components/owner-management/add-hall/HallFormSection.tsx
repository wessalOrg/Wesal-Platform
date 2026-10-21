"use client";

import type { ReactNode } from "react";

type HallFormSectionProps = {
  id: string;
  title: string;
  description?: string;
  /** Shown to the right of the title in RTL (start side). */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Shared section chrome aligned with seeker/owner dashboard cards. */
export default function HallFormSection({
  id,
  title,
  description,
  icon,
  className = "",
  children,
}: HallFormSectionProps) {
  return (
    <section
      className={`seeker-settings-card owner-add-hall-section min-w-0 space-y-4 overflow-visible ${className}`}
      aria-labelledby={id}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="inline-flex shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <h2 id={id} className="seeker-settings-section-title">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="seeker-settings-section-lead">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
