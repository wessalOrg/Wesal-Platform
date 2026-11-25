"use client";

import { useState } from "react";
import Link from "next/link";
import HallContactButton from "@/components/halls/HallContactButton";
import { OfferDetailsDialog } from "@/components/offers/ProfessionalOfferDetails";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import PostActionsMenu from "@/components/posts/PostActionsMenu";
import PostFavoriteButton from "@/components/posts/PostFavoriteButton";
import PostInquiryButton from "@/components/posts/PostInquiryButton";
import PostShareButton from "@/components/posts/PostShareButton";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { professionalProfilePath } from "@/lib/account-profile-path";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import { isPhotographerRole } from "@/lib/account-role";
import { formatRelativeTime } from "@/lib/relative-time";
import type { DiscoverItem } from "@/types/offers";
import CommunityIcon from "./CommunityIcon";
import { usePublicPublisher } from "./PublicPublishersProvider";

export default function CommunityContentCard({ item }: { item: DiscoverItem }) {
  const t = useT();
  const lang = useUiLang();
  const isPost = item.contentType === "Post", isHall = item.contentType === "HallOffer";
  const { profile, loading } = usePublicPublisher(isHall ? null : item.ownerUserId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const publisher = isHall ? item.displayName : profile?.shopName || profile?.onlineStoreName || profile?.studioName || profile?.displayName;
  const name = publisher || t("community.publisher");
  const profileHref = isHall ? item.hallId ? buildHallDetailsPath(item.hallId) : null
    : item.ownerUserId ? professionalProfilePath(item.ownerUserId) : null;
  const role = isHall ? t("community.hall") : profile?.role
    ? t(isPhotographerRole(profile.role) ? "community.photographer" : "community.coordinator") : t("community.provider");
  const postHref = `/posts/${encodeURIComponent(item.id)}`;
  const title = item.content?.split(/\r?\n/)[0]?.trim() || t(isPost ? "professionals.content.postUntitled" : "offers.card.untitled");
  const identity = <>
    <span className="community-avatar" aria-hidden="true"><AuthenticatedApiImage src={profile?.profilePictureUrl} alt=""
      showErrorFallback fallback={<CommunityIcon name={isHall ? "layers" : "person"} />} /></span>
    <span className="community-publisher-copy" aria-busy={loading}>
      <strong>{name}</strong><small>{role}{isPost ? <> · {formatRelativeTime(item.createdAt)}</> : null}</small>
    </span>
  </>;
  const cover = <><AuthenticatedApiImage src={item.imageUrl} alt="" showErrorFallback
    className="community-cover-image" fallback={<span className="community-cover-empty"><CommunityIcon name={isPost ? "image" : "tag"} />{t(isPost ? "professionals.content.noPostImage" : "offers.card.noImage")}</span>} />
    {!isPost ? <span className="community-special">{t("offers.card.badge")} <CommunityIcon name="tag" /></span> : null}</>;

  return <article className={`community-card ${isPost ? "community-post" : "community-offer"}`}
    data-testid={`community-${isPost ? "post" : "offer"}-${item.id}`}>
    {isPost ? <header className="community-post-header">
      {profileHref ? <Link href={profileHref} className="community-publisher">{identity}</Link> : <div className="community-publisher">{identity}</div>}
      <PostActionsMenu postId={item.id} profileHref={profileHref} />
    </header> : null}
    <div className="community-cover">
      {isPost ? <Link href={postHref} className="community-cover-link" aria-label={title}>{cover}</Link>
        : isHall ? <Link href={profileHref ?? "/discover?filter=Offers"} className="community-cover-link" aria-label={title}>{cover}</Link>
          : <button type="button" className="community-cover-link" aria-label={t("offers.card.viewDetails")}
            onClick={() => setDetailsOpen(true)}>{cover}<span className="community-view"><CommunityIcon name="eye" /></span></button>}
    </div>
    {isPost ? <>
      <div className="community-post-actions">
        <PostFavoriteButton postId={item.id} variant="icon" />
        <PostShareButton postId={item.id} />
        <Link href={postHref} className="community-comments" aria-label={t("community.comments")}><CommunityIcon name="comment" /></Link>
      </div>
      <Link href={postHref} className="community-caption"><p>{item.content?.trim() || t("professionals.content.postUntitled")}</p></Link>
      {item.price != null ? <p className="community-post-price">{new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US").format(item.price)} {t("offers.currency")}</p> : null}
    </> : <div className="community-offer-body">
      {profileHref ? <Link href={profileHref} className="community-publisher">{identity}</Link> : <div className="community-publisher">{identity}</div>}
      <h3 className="community-offer-title">{title}</h3>
      <div className="community-offer-price"><CommunityIcon name="tag" /><OfferPriceDisplay oldPrice={item.oldPrice} offerPrice={item.offerPrice} size="sm" /></div>
      <div className="community-card-actions">
        {profileHref ? <Link href={profileHref} className="community-profile-link"><CommunityIcon name="person" />{t(isHall ? "offers.card.viewHall" : "offers.card.viewProfile")}</Link> : null}
        {isHall ? item.hallId ? <HallContactButton hallId={item.hallId} variant="compact" label={t("community.message")} /> : null
          : <PostInquiryButton kind="offer" contentId={item.id} variant="primary" label={t("community.message")} />}
      </div>
    </div>}
    {detailsOpen && !isHall && !isPost ? <OfferDetailsDialog offerId={item.id} onClose={() => setDetailsOpen(false)} /> : null}
  </article>;
}
