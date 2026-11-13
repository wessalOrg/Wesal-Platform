import Link from "next/link";

type AdminRequestQueueMobileCardProps = {
  href: string;
  name: string;
  email: string;
  meta: string;
  statusClassName: string;
  statusLabel: string;
  openLabel: string;
  initial: string;
};

export default function AdminRequestQueueMobileCard({
  href,
  name,
  email,
  meta,
  statusClassName,
  statusLabel,
  openLabel,
  initial,
}: AdminRequestQueueMobileCardProps) {
  return (
    <li className="admin-coord-mobile-card">
      <div className="admin-coord-mobile-row">
        <div className="admin-coord-person">
          <span className="admin-coord-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="admin-coord-person-name !whitespace-normal">{name}</p>
            <p className="admin-coord-person-meta">
              <span dir="ltr" className="admin-coord-email">
                {email}
              </span>
            </p>
            <p className="admin-coord-person-meta">{meta}</p>
          </div>
        </div>
        <div className="admin-coord-mobile-side">
          <span className={statusClassName}>{statusLabel}</span>
          <Link href={href} className="admin-coord-details-btn" prefetch>
            <EyeIcon />
            {openLabel}
          </Link>
        </div>
      </div>
    </li>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
