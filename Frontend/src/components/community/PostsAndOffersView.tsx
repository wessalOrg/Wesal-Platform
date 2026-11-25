"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useContentPagination } from "@/hooks/useContentPagination";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
import { useT } from "@/i18n";
import { readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount } from "@/lib/authenticated-account";
import { filterVisibleDiscoverItems } from "@/lib/discover-filter";
import { fetchDiscoverFeed } from "@/services/discover";
import CommunityContentCard from "./CommunityContentCard";
import CommunityIcon from "./CommunityIcon";
import PublicPublishersProvider from "./PublicPublishersProvider";
import "./posts-and-offers.css";

export default function PostsAndOffersView() {
  return <PublicPublishersProvider><div className="container-wesal community-container" data-testid="posts-and-offers-page">
    <CommunityHeading />
    <ContentSection kind="offers" />
    <ContentSection kind="posts" />
  </div></PublicPublishersProvider>;
}

function CommunityHeading() {
  const t = useT();
  return <header className="community-hero">
    <svg className="community-hero-wave" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 163C105 173 92 225 243 225H414C522 225 518 139 645 90C742 52 805 11 951 0H1200V220H0Z" fill="currentColor" fillOpacity=".62" />
      <path d="M0 164C105 174 92 225 243 225H414C522 225 518 139 645 90" fill="none" stroke="var(--wesal-gold)" strokeOpacity=".35" strokeWidth=".8" />
      <path d="M0 204C71 186 105 211 163 220" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="2" />
    </svg>
    <svg className="community-hero-botanical" viewBox="0 0 100 66" fill="none" stroke="currentColor" strokeWidth=".8" aria-hidden="true">
      <path d="M99 2C75 10 52 29 32 62M95 3C76 4 43 10 13 25M91 5C79 17 78 36 75 53" />
      <path d="M76 11Q58 0 49 7Q61 16 76 11ZM60 20Q43 12 36 20Q48 27 60 20ZM45 37Q29 25 23 32Q29 44 45 37ZM37 50Q20 45 19 57Q31 60 37 50ZM82 17Q96 21 89 32Q78 29 82 17ZM78 31Q88 39 78 47Q71 40 78 31ZM48 13Q30 4 25 15Q36 22 48 13Z" />
    </svg>
    <div className="community-hero-copy"><h1><CommunityIcon name="layers" />{t("community.title")}</h1><p>{t("community.subtitle")}</p></div>
  </header>;
}

function ContentSection({ kind }: { kind: "posts" | "offers" }) {
  const t = useT(), lang = useUiLang();
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const context = useMemo(() => ({ account, kind }), [account, kind]);
  const fetchPage = useCallback((page: number, size: number) => fetchDiscoverFeed(kind === "offers" ? "Offers" : "All", page, size), [kind]);
  const pagination = useContentPagination({ context, pageSize: 12, fetchPage });
  const [expanded, setExpanded] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  useOfferLifecycle(kind === "offers" ? pagination.items : [], {
    enabled: kind === "offers", discoverUnloaded: kind === "offers", onRevalidate: pagination.refresh,
  });
  // All is a mixed backend feed. Its total is never presented as the total posts.
  const eligible = kind === "posts" ? pagination.items.filter(item => item.contentType === "Post")
    : filterVisibleDiscoverItems(pagination.items).filter(item => item.contentType === "ProfessionalOffer" || item.contentType === "HallOffer");
  const items = expanded ? eligible : eligible.slice(0, 6);
  const move = (forward: boolean) => {
    const direction = (lang === "ar" ? -1 : 1) * (forward ? 1 : -1);
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth, behavior: "smooth" });
  };
  const loadMore = () => { void pagination.loadMore(); };
  const retry = () => { void (pagination.loaded && pagination.hasMore ? pagination.loadMore() : pagination.refresh()); };

  return <section className="community-section" aria-labelledby={`community-${kind}-title`} data-testid={`community-${kind}-section`}>
    <header className="community-section-heading">
      <div><h2 id={`community-${kind}-title`}><CommunityIcon name={kind === "offers" ? "tag" : "image"} />{t(`community.${kind}.title`)}</h2><p>{t(`community.${kind}.subtitle`)}</p></div>
      <button type="button" className="community-view-all" aria-expanded={expanded} aria-controls={`community-${kind}-items`}
        onClick={() => setExpanded(value => !value)}>{t(expanded ? "community.showLess" : `community.${kind}.all`)}<CommunityIcon name="arrow" /></button>
    </header>
    {!pagination.loaded && pagination.busy ? <div className="community-grid" role="status" aria-label={t("common.loading")}>
      {[0, 1, 2].map(index => <div className="community-skeleton" key={index} />)}
    </div> : null}
    {pagination.loaded && !items.length && !pagination.error ? <div className="community-empty">
      <CommunityIcon name={kind === "offers" ? "tag" : "image"} />
      <p>{t(pagination.hasMore ? "community.exploreMore" : `community.${kind}.empty`)}</p>
    </div> : null}
    <div className="community-rail-wrap">
      {!expanded && items.length > 1 ? <button type="button" className="community-scroll community-scroll-prev"
        aria-label={t("community.previous")} aria-controls={`community-${kind}-items`} onClick={() => move(false)}><CommunityIcon name="arrow" /></button> : null}
      <div ref={rail} id={`community-${kind}-items`} className={expanded ? "community-grid" : "community-rail"}
        tabIndex={items.length ? 0 : undefined} role="region" aria-label={t(`community.${kind}.title`)}>
        {items.map(item => <CommunityContentCard key={`${item.contentType}-${item.id}`} item={item} />)}
      </div>
      {!expanded && items.length > 1 ? <button type="button" className="community-scroll community-scroll-next"
        aria-label={t("community.next")} aria-controls={`community-${kind}-items`} onClick={() => move(true)}><CommunityIcon name="arrow" /></button> : null}
    </div>
    {pagination.error ? <div className="community-feedback" role="alert"><p>{t("content.pagination.error")}</p>
      <button type="button" className="community-view-all" disabled={pagination.busy} onClick={retry}>{t("common.retry")}</button></div> : null}
    {pagination.loaded && pagination.hasMore && !pagination.error ? <div className="community-feedback">
      <button type="button" className="community-view-all" disabled={pagination.busy} onClick={() => { setExpanded(true); loadMore(); }}>
        {t(pagination.busy ? "common.loading" : "content.pagination.more")}</button>
    </div> : null}
  </section>;
}
