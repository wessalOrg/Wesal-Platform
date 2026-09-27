"use client";

import HallNotificationCard from "@/components/halls/notifications/HallNotificationCard";
import { groupOwnerNotifications } from "@/lib/owner-acceptance-ui";
import { useT } from "@/i18n";
import type { HallBookingNotification } from "@/types/hall-notifications";

type HallNotificationListProps = {
  items: HallBookingNotification[];
  labelledBy?: string;
  acceptingId?: string | null;
  rejectingId?: string | null;
  confirmingId?: string | null;
  acceptErrorById?: Record<string, string>;
  rejectErrorById?: Record<string, string>;
  confirmErrorById?: Record<string, string>;
  highlightedId?: string | null;
  hallName?: string | null;
  onAccept?: (notification: HallBookingNotification) => void;
  onReject?: (notification: HallBookingNotification) => void;
  onConfirmPayment?: (notification: HallBookingNotification) => void;
};

export default function HallNotificationList({
  items,
  labelledBy,
  acceptingId = null,
  rejectingId = null,
  confirmingId = null,
  acceptErrorById = {},
  rejectErrorById = {},
  confirmErrorById = {},
  highlightedId = null,
  hallName = null,
  onAccept,
  onReject,
  onConfirmPayment,
}: HallNotificationListProps) {
  const t = useT();
  const groups = groupOwnerNotifications(items);
  const sections = [
    {
      id: "pending",
      title: t("owner.notifications.group.pending"),
      items: groups.pending,
    },
    {
      id: "depositPending",
      title: t("owner.notifications.group.depositPending"),
      items: groups.depositPending,
    },
    {
      id: "handled",
      title: t("owner.notifications.group.handled"),
      items: groups.handled,
    },
  ].filter((section) => section.items.length > 0);
  const actionLocked = Boolean(acceptingId || rejectingId || confirmingId);

  return (
    <div className="min-w-0 space-y-5" data-testid="hall-notifications-list" aria-labelledby={labelledBy}>
      {sections.map((section) => {
        const headingId = `hall-notifications-group-${section.id}`;
        return (
          <section key={section.id} className="min-w-0" aria-labelledby={headingId} data-group={section.id}>
            <h3
              id={headingId}
              className="mb-2 text-[0.72rem] font-bold tracking-wide text-[var(--wesal-muted)]"
            >
              {section.title}
            </h3>
            <ul className="min-w-0 space-y-3">
              {section.items.map((item) => (
                <li key={item.id} className="min-w-0">
                  <HallNotificationCard
                    notification={item}
                    accepting={acceptingId === item.id}
                    rejecting={rejectingId === item.id}
                    confirming={confirmingId === item.id}
                    acceptLocked={actionLocked && acceptingId !== item.id}
                    rejectLocked={actionLocked && rejectingId !== item.id}
                    confirmLocked={actionLocked && confirmingId !== item.id}
                    acceptErrorKey={acceptErrorById[item.id] ?? null}
                    rejectErrorKey={rejectErrorById[item.id] ?? null}
                    confirmErrorKey={confirmErrorById[item.id] ?? null}
                    highlighted={highlightedId === item.id}
                    hallName={hallName}
                    onAccept={onAccept}
                    onReject={onReject}
                    onConfirmPayment={onConfirmPayment}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
