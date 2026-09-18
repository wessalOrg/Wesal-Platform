"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { ownerHallPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { HallOwnerHall } from "@/types/hall-owner-halls";

type HallSidebarItemProps = {
  hall: HallOwnerHall;
  active: boolean;
  onNavigate?: () => void;
};

export default function HallSidebarItem({
  hall,
  active,
  onNavigate,
}: HallSidebarItemProps) {
  const lang = useUiLang();
  const name = localizeHallName(hall.id, hall.name, lang);

  return (
    <Link
      href={ownerHallPath(hall.id)}
      prefetch
      className={`owner-hall-sidebar-item${active ? " owner-hall-sidebar-item--active" : ""}`}
      aria-current={active ? "page" : undefined}
      data-testid={`owner-hall-sidebar-item-${hall.id}`}
      data-hall-id={hall.id}
      title={name}
      onClick={onNavigate}
    >
      <span className="owner-hall-sidebar-item-name">{name}</span>
    </Link>
  );
}
