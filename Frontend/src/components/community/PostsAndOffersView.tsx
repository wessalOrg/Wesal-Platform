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
  return (
    <header className="community-hero" data-testid="community-hero">
      <div className="community-hero-copy">
        <h1>
          <CommunityIcon name="layers" />
          {t("community.title")}
        </h1>
        <p>{t("community.subtitle")}</p>
        <div className="community-hero-rule">
          <span />
          <CommunityIcon name="calendar" />
          <span />
        </div>
        <div className="community-hero-actions">
          <a className="community-hero-cta community-hero-cta-posts" href="#community-posts-section">
            <CommunityIcon name="image" />
            {t("community.posts.title")}
            <CommunityIcon name="arrow" />
          </a>
          <a className="community-hero-cta community-hero-cta-offers" href="#community-offers-section">
            <CommunityIcon name="tag" />
            {t("community.offers.title")}
            <CommunityIcon name="arrow" />
          </a>
        </div>
      </div>

      <div className="community-hero-visual" aria-hidden="true">
        <div className="community-hero-percent">
          <span>%</span>
        </div>
        <article className="community-hero-post">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative hero collage asset */}
          <img
            className="community-hero-post-image"
            src="/hero/hall-ballroom.jpg"
            alt=""
          />
          <div className="community-hero-post-actions">
            <CommunityIcon name="heart" />
            <CommunityIcon name="comment" />
            <CommunityIcon name="share" />
            <CommunityIcon name="bookmark" />
          </div>
        </article>
        <div className="community-hero-gift">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative accent */}
          <img src="/community/hero-flowers.webp" alt="" />
        </div>
        <span className="community-hero-silk" />
      </div>
    </header>
  );
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

  return <section id={`community-${kind}-section`} className="community-section" aria-labelledby={`community-${kind}-title`} data-testid={`community-${kind}-section`}>
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
