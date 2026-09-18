"use client";

import type { ReactNode } from "react";

type HallFormSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Shared section chrome aligned with seeker/owner dashboard cards. */
export default function HallFormSection({
  id,
  title,
  description,
  children,
}: HallFormSectionProps) {
  return (
    <section
      className="seeker-settings-card owner-add-hall-section min-w-0 space-y-4 overflow-visible"
      aria-labelledby={id}
    >
      <div className="min-w-0">
        <h2 id={id} className="seeker-settings-section-title">
          {title}
        </h2>
        {description ? (
          <p className="seeker-settings-section-lead">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
