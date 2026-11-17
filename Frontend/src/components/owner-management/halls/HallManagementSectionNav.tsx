"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isOwnerHallNotificationsPath,
  isOwnerHallOffersPath,
  ownerHallNotificationsPath,
  ownerHallOffersPath,
  ownerHallPath,
} from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";

type HallManagementSectionNavProps = {
  hallId: string;
};

/**
 * Hall-scoped management sections: Details | Offers | Notifications.
 */
export default function HallManagementSectionNav({
  hallId,
}: HallManagementSectionNavProps) {
  const t = useT();
  const pathname = usePathname();
  const detailsHref = ownerHallPath(hallId);
  const offersHref = ownerHallOffersPath(hallId);
  const notificationsHref = ownerHallNotificationsPath(hallId);
  const notificationsActive = isOwnerHallNotificationsPath(pathname);
  const offersActive = isOwnerHallOffersPath(pathname);
  const detailsActive =
    !notificationsActive &&
    !offersActive &&
    (pathname === detailsHref || pathname.startsWith(`${detailsHref}/`));

  return (
    <nav
      className="owner-hall-section-nav"
      aria-label={t("owner.management.hallNav.label")}
      data-testid="owner-hall-section-nav"
      data-hall-id={hallId}
    >
      <Link
        href={detailsHref}
        className={`owner-hall-section-nav-link${
          detailsActive ? " owner-hall-section-nav-link--active" : ""
        }`}
        aria-current={detailsActive ? "page" : undefined}
        data-testid="owner-hall-nav-details"
      >
        {t("owner.management.hallNav.details")}
      </Link>
      <Link
        href={offersHref}
        className={`owner-hall-section-nav-link${
          offersActive ? " owner-hall-section-nav-link--active" : ""
        }`}
        aria-current={offersActive ? "page" : undefined}
        data-testid="owner-hall-nav-offers"
      >
        {t("owner.management.hallNav.offers")}
      </Link>
      <Link
        href={notificationsHref}
        className={`owner-hall-section-nav-link${
          notificationsActive ? " owner-hall-section-nav-link--active" : ""
        }`}
        aria-current={notificationsActive ? "page" : undefined}
        data-testid="owner-hall-nav-notifications"
      >
        {t("owner.management.hallNav.notifications")}
      </Link>
    </nav>
  );
}
