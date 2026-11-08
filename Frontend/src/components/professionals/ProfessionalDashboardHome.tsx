"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useProfessionalReviewNotes } from "@/hooks/useProfessionalReviewNotes";
import { useT } from "@/i18n";
import {
  COORDINATOR_SETUP_PATH,
  PHOTOGRAPHER_SETUP_PATH,
  REGULAR_MESSAGES_PATH,
  professionalProfilePath,
} from "@/lib/account-profile-path";
import { isPhotographerRole } from "@/lib/account-role";
import { ApiError } from "@/lib/api-error";
import { professionalRoleLabelKey } from "@/lib/professional-role-label";
import { contactAdminAccount, conversationErrorMessage } from "@/services/conversations";
import type { ProfessionalAccountPhase } from "@/types/account-approval";
import "./professional-dashboard.css";

const RESUBMIT_QUERY = "mode=edit";

type FeatureCard = {
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  locked?: boolean;
  icon: ReactNode;
};

export default function ProfessionalDashboardHome() {
  const t = useT();
  const router = useRouter();
  const access = useProfessionalAccountAccess();
  const [contactPending, setContactPending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const phase = access.phase;
  const { notes: adminNotes, loading: notesLoading } = useProfessionalReviewNotes(phase);
  const roleLabel = t(professionalRoleLabelKey(access.role));
  const canPublish = access.canPublish;
  const profileId = access.profile?.id?.trim() || access.userId?.trim() || "";
  const publicProfileHref = profileId ? professionalProfilePath(profileId) : "/profile";
  const editHref = isPhotographerRole(access.role)
    ? `${PHOTOGRAPHER_SETUP_PATH}?${RESUBMIT_QUERY}`
    : `${COORDINATOR_SETUP_PATH}?${RESUBMIT_QUERY}`;

  const onContactAdmin = async () => {
    if (contactPending) return;
    setContactPending(true);
    setContactError(null);
    try {
      const thread = await contactAdminAccount();
      router.push(
        `${REGULAR_MESSAGES_PATH}?conversation_id=${encodeURIComponent(thread.conversationId)}`,
      );
    } catch (error) {
      setContactError(
        error instanceof ApiError
          ? conversationErrorMessage(error, "start")
          : t("auth.pendingAccount.contactAdminError"),
      );
    } finally {
      setContactPending(false);
    }
  };

  const available: FeatureCard[] = [
    {
      id: "browse",
      titleKey: "pro.dash.feature.browse.title",
      bodyKey: "pro.dash.feature.browse.body",
      ctaKey: "pro.dash.feature.browse.cta",
      href: "/halls",
      icon: <BrowseIcon />,
    },
    {
      id: "book",
      titleKey: "pro.dash.feature.book.title",
      bodyKey: "pro.dash.feature.book.body",
      ctaKey: "pro.dash.feature.book.cta",
      href: "/halls",
      icon: <BookIcon />,
    },
    {
      id: "admin",
      titleKey: "pro.dash.feature.admin.title",
      bodyKey: "pro.dash.feature.admin.body",
      ctaKey: contactPending
        ? "auth.pendingAccount.contactAdminOpening"
        : "pro.dash.feature.admin.cta",
      onClick: () => void onContactAdmin(),
      busy: contactPending,
      icon: <ChatIcon />,
    },
  ];

  const locked: FeatureCard[] = [
    {
      id: "content",
      titleKey: "pro.dash.feature.content.title",
      bodyKey: "pro.dash.feature.content.body",
      ctaKey: "pro.dash.feature.lockedCta",
      locked: true,
      icon: <ContentIcon />,
    },
    {
      id: "offer",
      titleKey: "pro.dash.feature.offer.title",
      bodyKey: "pro.dash.feature.offer.body",
      ctaKey: "pro.dash.feature.lockedCta",
      locked: true,
      icon: <OfferIcon />,
    },
    {
      id: "post",
      titleKey: "pro.dash.feature.post.title",
      bodyKey: "pro.dash.feature.post.body",
      ctaKey: "pro.dash.feature.lockedCta",
      locked: true,
      icon: <PostIcon />,
    },
  ];

  const quickActions: FeatureCard[] = [
    {
      id: "qa-book",
      titleKey: "pro.dash.feature.book.title",
      bodyKey: "pro.dash.feature.book.body",
      ctaKey: "pro.dash.feature.book.cta",
      href: "/halls",
      icon: <BookIcon />,
    },
    {
      id: "qa-admin",
      titleKey: "pro.dash.feature.admin.title",
      bodyKey: "pro.dash.feature.admin.body",
      ctaKey: contactPending
        ? "auth.pendingAccount.contactAdminOpening"
        : "pro.dash.feature.admin.cta",
      onClick: () => void onContactAdmin(),
      busy: contactPending,
      icon: <ChatIcon />,
    },
    {
      id: "qa-post",
      titleKey: "pro.dash.feature.post.title",
      bodyKey: "pro.dash.quick.post.body",
      ctaKey: "pro.dash.feature.post.cta",
      href: canPublish ? publicProfileHref : undefined,
      locked: !canPublish,
      icon: <PostIcon />,
    },
    {
      id: "qa-offer",
      titleKey: "pro.dash.feature.offer.title",
      bodyKey: "pro.dash.quick.offer.body",
      ctaKey: "pro.dash.feature.offer.cta",
      href: canPublish ? publicProfileHref : undefined,
      locked: !canPublish,
      icon: <OfferIcon />,
    },
  ];

  return (
    <div
      className="pro-dash"
      data-testid="professional-dashboard-home"
      data-phase={phase}
      data-role={access.role ?? ""}
    >
      <StatusBanner
        phase={phase}
        roleLabel={roleLabel}
        canResubmit={access.canResubmitSetup}
        editHref={editHref}
        contactPending={contactPending}
        onContactAdmin={() => void onContactAdmin()}
      />

      {phase === "needs_changes" || phase === "rejected" ? (
        <aside className="pro-dash-notes" data-testid="pro-dash-admin-notes">
          <p className="pro-dash-notes-label">
            {phase === "needs_changes"
              ? t("auth.pendingAccount.notesLabelNeedsChanges")
              : t("auth.pendingAccount.notesLabelRejected")}
          </p>
          {adminNotes ? (
            <p className="pro-dash-notes-body">{adminNotes}</p>
          ) : notesLoading ? (
            <p className="pro-dash-notes-body text-[var(--wesal-muted)]" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : (
            <p className="pro-dash-notes-body text-[var(--wesal-muted)]">
              {t("pro.dash.notesUnavailable")}
            </p>
          )}
        </aside>
      ) : null}

      {contactError ? (
        <p className="text-sm font-medium text-[#b42318]" role="alert">
          {contactError}
        </p>
      ) : null}

      {phase === "approved" ? (
        <section aria-labelledby="pro-dash-quick-heading">
          <h2 id="pro-dash-quick-heading" className="pro-dash-section-title">
            {t("pro.dash.quickTitle")}
          </h2>
          <div className="pro-dash-grid pro-dash-grid--4">
            {quickActions.map((card) => (
              <FeatureCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="pro-dash-available-heading">
            <h2 id="pro-dash-available-heading" className="pro-dash-section-title">
              {t("pro.dash.availableTitle")}
            </h2>
            <div className="pro-dash-grid pro-dash-grid--3">
              {available.map((card) => (
                <FeatureCardView key={card.id} card={card} />
              ))}
            </div>
          </section>

          <section aria-labelledby="pro-dash-locked-heading">
            <h2 id="pro-dash-locked-heading" className="pro-dash-section-title">
              {t("pro.dash.lockedTitle")}
            </h2>
            <div className="pro-dash-grid pro-dash-grid--3">
              {locked.map((card) => (
                <FeatureCardView key={card.id} card={card} />
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="pro-dash-stats-heading">
        <h2 id="pro-dash-stats-heading" className="pro-dash-section-title">
          {t("pro.dash.statsTitle")}
        </h2>
        <div className="pro-dash-stats">
          <div className="pro-dash-stat">
            <p className="pro-dash-stat-value">0</p>
            <p className="pro-dash-stat-label">{t("pro.dash.stats.bookings")}</p>
          </div>
          <div className="pro-dash-stat">
            <p className="pro-dash-stat-value">0</p>
            <p className="pro-dash-stat-label">{t("pro.dash.stats.followers")}</p>
          </div>
          <div className="pro-dash-stat">
            <p className="pro-dash-stat-value">0</p>
            <p className="pro-dash-stat-label">{t("pro.dash.stats.posts")}</p>
          </div>
        </div>
      </section>

      {phase === "rejected" || phase === "needs_changes" ? (
        <p className="pro-dash-foot">
          <HelpIcon />
          <span>
            {phase === "rejected"
              ? t("pro.dash.whyRejected")
              : t("pro.dash.whyNeedsChanges")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function StatusBanner({
  phase,
  roleLabel,
  canResubmit,
  editHref,
  contactPending,
  onContactAdmin,
}: {
  phase: ProfessionalAccountPhase;
  roleLabel: string;
  canResubmit: boolean;
  editHref: string;
  contactPending: boolean;
  onContactAdmin: () => void;
}) {
  const t = useT();
  const copy = bannerCopy(phase, t);

  return (
    <section
      className={`pro-dash-banner pro-dash-banner--${phase}`}
      data-testid="pro-dash-status-banner"
      aria-label={copy.title}
    >
      <div className="pro-dash-banner-copy">
        <p className="pro-dash-banner-kicker">
          <StatusGlyph phase={phase} />
          <span>{roleLabel}</span>
        </p>
        <h1 className="pro-dash-banner-title">{copy.title}</h1>
        <p className="pro-dash-banner-body">{copy.body}</p>
        {phase !== "approved" ? (
          <div className="pro-dash-banner-actions">
            {canResubmit ? (
              <Link href={editHref} className="pro-dash-card-cta" data-testid="pro-dash-edit">
                {t("auth.pendingAccount.editResubmit")}
              </Link>
            ) : null}
            <button
              type="button"
              className={
                canResubmit ? "pro-dash-card-cta pro-dash-card-cta--ghost" : "pro-dash-card-cta"
              }
              disabled={contactPending}
              aria-busy={contactPending || undefined}
              data-testid="pro-dash-contact-admin"
              onClick={onContactAdmin}
            >
              {contactPending
                ? t("auth.pendingAccount.contactAdminOpening")
                : t("auth.pendingAccount.contactAdmin")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function bannerCopy(
  phase: ProfessionalAccountPhase,
  t: (key: string) => string,
): { title: string; body: string } {
  switch (phase) {
    case "approved":
      return {
        title: t("pro.dash.banner.approved.title"),
        body: t("pro.dash.banner.approved.body"),
      };
    case "rejected":
      return {
        title: t("pro.dash.banner.rejected.title"),
        body: t("pro.dash.banner.rejected.body"),
      };
    case "needs_changes":
      return {
        title: t("pro.dash.banner.needsChanges.title"),
        body: t("pro.dash.banner.needsChanges.body"),
      };
    default:
      return {
        title: t("pro.dash.banner.pending.title"),
        body: t("pro.dash.banner.pending.body"),
      };
  }
}

function FeatureCardView({ card }: { card: FeatureCard }) {
  const t = useT();
  const locked = Boolean(card.locked);
  const ctaLabel = t(card.ctaKey);

  const cta =
    locked || (!card.href && !card.onClick) ? (
      <span className="pro-dash-card-cta" aria-disabled="true">
        {ctaLabel}
      </span>
    ) : card.href ? (
      <Link href={card.href} className="pro-dash-card-cta" prefetch>
        {ctaLabel}
      </Link>
    ) : (
      <button
        type="button"
        className="pro-dash-card-cta"
        disabled={card.busy}
        aria-busy={card.busy || undefined}
        onClick={card.onClick}
      >
        {ctaLabel}
      </button>
    );

  return (
    <article
      className={`pro-dash-card${locked ? " pro-dash-card--locked" : ""}`}
      data-testid={`pro-dash-card-${card.id}`}
    >
      <div className="pro-dash-card-top">
        <span className="pro-dash-card-icon" aria-hidden="true">
          {card.icon}
        </span>
        <span className={`pro-dash-badge ${locked ? "pro-dash-badge--off" : "pro-dash-badge--on"}`}>
          {locked ? t("pro.dash.badge.off") : t("pro.dash.badge.on")}
        </span>
      </div>
      <h3 className="pro-dash-card-title">{t(card.titleKey)}</h3>
      <p className="pro-dash-card-body">{t(card.bodyKey)}</p>
      {cta}
    </article>
  );
}

function StatusGlyph({ phase }: { phase: ProfessionalAccountPhase }) {
  if (phase === "approved") return <CheckGlyph />;
  if (phase === "rejected" || phase === "needs_changes") return <AlertGlyph />;
  return <ClockGlyph />;
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M12 4.5 20 19H4L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m8.5 12.2 2.4 2.4 4.6-4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.8 9.4a2.3 2.3 0 0 1 4.4.9c0 1.4-1.3 2-2.2 2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

function BrowseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.2A2.5 2.5 0 0 1 5 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function OfferIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.5 12 5l7.5 7.5L12 20l-7.5-7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="10.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

function PostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M7 17.5 16.5 8l2.5 2.5L9.5 20H7v-2.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m14.8 9.7 2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
