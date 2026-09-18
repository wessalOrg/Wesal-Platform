import {
  SEEKER_BOOKINGS_PATH,
  SEEKER_MESSAGES_PATH,
} from "@/constants/seekerDashboardNav";

export type SeekerNotificationItem = {
  id: string;
  titleKey: string;
  bodyKey: string;
  timeKey: string;
  href: string;
};

/**
 * Shared seeker notifications feed until a backend API is available.
 * Used by the topbar popover and the full dashboard notifications page.
 */
export const SEEKER_NOTIFICATIONS: SeekerNotificationItem[] = [
  {
    id: "booking-update",
    titleKey: "seeker.notifications.demo.bookingTitle",
    bodyKey: "seeker.notifications.demo.bookingBody",
    timeKey: "seeker.notifications.demo.bookingTime",
    href: SEEKER_BOOKINGS_PATH,
  },
  {
    id: "message",
    titleKey: "seeker.notifications.demo.messageTitle",
    bodyKey: "seeker.notifications.demo.messageBody",
    timeKey: "seeker.notifications.demo.messageTime",
    href: SEEKER_MESSAGES_PATH,
  },
  {
    id: "favorite-hint",
    titleKey: "seeker.notifications.demo.favoriteTitle",
    bodyKey: "seeker.notifications.demo.favoriteBody",
    timeKey: "seeker.notifications.demo.favoriteTime",
    href: "/halls",
  },
];
