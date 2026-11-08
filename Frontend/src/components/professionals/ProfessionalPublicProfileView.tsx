"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ProfessionalBioEditor from "@/components/professionals/ProfessionalBioEditor";
import ProfessionalContentCard from "@/components/professionals/ProfessionalContentCard";
import ProfessionalOfferForm from "@/components/professionals/ProfessionalOfferForm";
import ProfessionalPostForm from "@/components/professionals/ProfessionalPostForm";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useProfessionalPublicProfile } from "@/hooks/useProfessionalPublicProfile";
import { useStartProfessionalConversation } from "@/hooks/useStartProfessionalConversation";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { buildProfessionalContactLoginRedirectPath } from "@/lib/auth-storage";
import { resolveMediaUrl } from "@/lib/hall-media-url";
import {
  PROFESSIONAL_PICTURE_ACCEPT,
  validateProfessionalPicture,
} from "@/lib/professional-picture-validation";
import {
  isCoordinatorProfessional,
  isPhotographerProfessional,
  professionalPublicLocation,
} from "@/lib/professional-profile-mapper";
import {
  fetchOwnProfessionalOffers,
  stopProfessionalOffer,
} from "@/services/professional-offers";
import {
  fetchProfessionalProfileOffers,
  fetchProfessionalProfilePosts,
  uploadProfessionalProfilePicture,
} from "@/services/professional-profile";
import type {
  ProfessionalProfileContentItem,
  ProfessionalProfileTab,
  PublicProfessionalProfile,
} from "@/types/professional-profile";
import "./professional-public-profile.css";

type ProfessionalPublicProfileViewProps = {
  userId: string;
};

function roleLabelKey(profile: PublicProfessionalProfile): string {
  if (isPhotographerProfessional(profile.role)) {
    return profile.studioName
      ? "professionals.role.studioPhotographer"
      : "professionals.role.independentPhotographer";
  }
  if (isCoordinatorProfessional(profile.role)) {
    return profile.shopName
      ? "professionals.role.shopCoordinator"
      : "professionals.role.freelanceCoordinator";
  }
  return "professionals.role.professional";
}

function messageLabelKey(profile: PublicProfessionalProfile): string {
  return isPhotographerProfessional(profile.role)
    ? "professionals.contact.photographer"
    : "professionals.contact.coordinator";
}

export default function ProfessionalPublicProfileView({
  userId,
}: ProfessionalPublicProfileViewProps) {
  const t = useT();
  const pictureInputId = useId();
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const postsFetchStartedRef = useRef(false);
  const { ready, authenticated, userId: viewerId, isAdmin } = useAccountAccess();
  const { status, profile, errorKey, loading, reload } =
    useProfessionalPublicProfile(userId);
  const { start, starting, error: contactError } = useStartProfessionalConversation();
  const [tab, setTab] = useState<ProfessionalProfileTab>("posts");
  const [bioOpen, setBioOpen] = useState(false);
  const [localBio, setLocalBio] = useState<string | null | undefined>(undefined);
  const [localPictureUrl, setLocalPictureUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [pictureUploading, setPictureUploading] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [pictureSuccess, setPictureSuccess] = useState<string | null>(null);
  const [posts, setPosts] = useState<ProfessionalProfileContentItem[] | null>(null);
  const [offers, setOffers] = useState<ProfessionalProfileContentItem[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [postFormMode, setPostFormMode] = useState<"create" | "edit" | null>(null);
  const [editingPost, setEditingPost] =
    useState<ProfessionalProfileContentItem | null>(null);
  const [postActionSuccess, setPostActionSuccess] = useState<string | null>(null);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [offerActionSuccess, setOfferActionSuccess] = useState<string | null>(null);
  const [seenUserId, setSeenUserId] = useState(userId);

  if (userId !== seenUserId) {
    setSeenUserId(userId);
    setLocalBio(undefined);
    setLocalPictureUrl(undefined);
    setPictureError(null);
    setPictureSuccess(null);
    setBioOpen(false);
    setTab("posts");
    setPosts(null);
    setOffers(null);
    setListError(null);
    postsFetchStartedRef.current = false;
    setPostFormMode(null);
    setEditingPost(null);
    setPostActionSuccess(null);
    setOfferFormOpen(false);
    setOfferActionSuccess(null);
  }

  const isOwner = Boolean(
    ready && authenticated && viewerId && profile && viewerId === profile.userId,
  );
  const canManagePosts = Boolean(isOwner && profile?.isPubliclyAvailable);
  const canManageOffers = canManagePosts;

  const displayBio =
    localBio !== undefined ? localBio : (profile?.bio ?? null);
  const displayPictureUrl =
    localPictureUrl !== undefined
      ? localPictureUrl
      : (profile?.profilePictureUrl ?? null);

  const loadTabLists = useCallback(
    async (nextTab: ProfessionalProfileTab) => {
      if (!profile?.isPubliclyAvailable) return;
      setListLoading(true);
      setListError(null);
      try {
        if (nextTab === "posts") {
          const page = await fetchProfessionalProfilePosts(profile.userId, 1, 12);
          setPosts(page.items);
        } else if (canManageOffers) {
          const page = await fetchOwnProfessionalOffers(1, 20);
          setOffers(page.items);
        } else {
          const page = await fetchProfessionalProfileOffers(profile.userId, 1, 12);
          setOffers(page.items);
        }
      } catch {
        setListError(
          nextTab === "posts"
            ? "professionals.posts.errors.loadFailed"
            : "professionals.offers.errors.loadFailed",
        );
      } finally {
        setListLoading(false);
      }
    },
    [profile, canManageOffers],
  );

  useEffect(() => {
    if (!profile?.isPubliclyAvailable) return;
    if (tab !== "posts" || posts !== null || postsFetchStartedRef.current) return;
    postsFetchStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void loadTabLists("posts");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile?.isPubliclyAvailable, profile?.userId, tab, posts, loadTabLists]);

  const onTabChange = (next: ProfessionalProfileTab) => {
    setTab(next);
    if (next === "posts" && posts === null) {
      postsFetchStartedRef.current = true;
      void loadTabLists("posts");
    }
    if (next === "offers" && offers === null) void loadTabLists("offers");
  };

  const refreshAfterPostMutation = async (mode: "create" | "edit") => {
    setPosts(null);
    setPostActionSuccess(
      mode === "edit"
        ? t("professionals.posts.updateSuccess")
        : t("professionals.posts.createSuccess"),
    );
    await reload();
    if (tab === "posts") void loadTabLists("posts");
  };

  const refreshAfterOfferMutation = async (messageKey: string) => {
    setOffers(null);
    setOfferActionSuccess(t(messageKey));
    await reload();
    if (tab === "offers") void loadTabLists("offers");
  };

  const onStopOffer = async (item: ProfessionalProfileContentItem) => {
    try {
      await stopProfessionalOffer(item.id);
      await refreshAfterOfferMutation("professionals.offers.stopSuccess");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setOffers(null);
        await reload();
        if (tab === "offers") void loadTabLists("offers");
        throw new Error(t("professionals.offers.errors.stopConflict"));
      }
      throw error;
    }
  };

  const openPicturePicker = () => {
    setPictureError(null);
    setPictureSuccess(null);
    pictureInputRef.current?.click();
  };

  const onPictureSelected = async (file: File | null) => {
    if (!file) return;
    const issue = validateProfessionalPicture(file);
    if (issue) {
      setPictureError(
        t(
          issue === "tooLarge"
            ? "professionals.picture.errors.tooLarge"
            : issue === "type"
              ? "professionals.picture.errors.type"
              : "professionals.picture.errors.empty",
        ),
      );
      return;
    }
    setPictureUploading(true);
    setPictureError(null);
    setPictureSuccess(null);
    try {
      const url = await uploadProfessionalProfilePicture(file);
      const bust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      setLocalPictureUrl(bust);
      setPictureSuccess(t("professionals.picture.uploadSuccess"));
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setPictureError(t("professionals.picture.errors.forbidden"));
      } else {
        setPictureError(t("professionals.picture.errors.uploadFailed"));
      }
    } finally {
      setPictureUploading(false);
      if (pictureInputRef.current) pictureInputRef.current.value = "";
    }
  };

  const loginHref = useMemo(
    () => buildProfessionalContactLoginRedirectPath(userId),
    [userId],
  );

  if (loading) {
    return (
      <div
        className="min-h-[28rem] animate-pulse rounded-3xl bg-white/70"
        aria-busy="true"
        data-testid="professional-profile-loading"
      />
    );
  }

  if (status === "notFound" || (status === "error" && !profile)) {
    return (
      <section
        className="rounded-3xl border border-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] bg-white px-5 py-10 text-center shadow-sm"
        role="alert"
        data-testid="professional-profile-unavailable"
      >
        <h1 className="text-xl font-bold text-[var(--wesal-text)]">
          {t(
            status === "notFound"
              ? "professionals.profile.unavailableTitle"
              : "professionals.profile.errors.loadFailed",
          )}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
          {t(
            status === "notFound"
              ? "professionals.profile.unavailableBody"
              : errorKey || "professionals.profile.errors.loadFailed",
          )}
        </p>
        {status === "error" ? (
          <button type="button" className="btn-outline mt-5" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        ) : (
          <Link href="/" className="btn-outline mt-5 inline-flex">
            {t("professionals.profile.backHome")}
          </Link>
        )}
      </section>
    );
  }

  if (!profile) return null;

  if (!profile.isPubliclyAvailable) {
    return (
      <section
        className="rounded-3xl border border-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] bg-white px-5 py-10 text-center shadow-sm"
        data-testid="professional-profile-private"
      >
        <h1 className="text-xl font-bold text-[var(--wesal-text)]">
          {t("professionals.profile.notPublicTitle")}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("professionals.profile.notPublicBody")}
        </p>
        <Link href="/profile" className="btn-outline mt-5 inline-flex">
          {t("professionals.profile.backAccount")}
        </Link>
      </section>
    );
  }

  const avatarUrl = displayPictureUrl ? resolveMediaUrl(displayPictureUrl) : "";
  const location = professionalPublicLocation(profile);
  const postsForTab = posts ?? profile.posts;
  const offersForTab = offers ?? profile.offers;
  const postsCount = posts?.length ?? profile.posts.length;
  const offersCount = offers?.length ?? profile.offers.length;

  return (
    <div className="ppp" data-testid="professional-public-profile">
      <section className="ppp-hero">
        <div className="ppp-hero-inner">
          <div className="ppp-identity">
            <div className="ppp-avatar-wrap">
              <div className="ppp-avatar">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={t("professionals.profile.avatarAlt", {
                      name: profile.displayName,
                    })}
                  />
                ) : (
                  <div className="ppp-avatar-fallback" aria-hidden="true">
                    {profile.displayName.slice(0, 1)}
                  </div>
                )}
              </div>
              {isOwner ? (
                <button
                  type="button"
                  className="ppp-avatar-edit"
                  disabled={pictureUploading}
                  aria-busy={pictureUploading || undefined}
                  aria-label={t("professionals.picture.changeAction")}
                  data-testid="professional-picture-edit-avatar"
                  onClick={openPicturePicker}
                >
                  <PencilIcon />
                </button>
              ) : null}
            </div>

            <div className="ppp-identity-text">
              <div className="ppp-name-row">
                <h1 className="ppp-name">{profile.displayName}</h1>
                <span className="ppp-verified">
                  <CheckIcon />
                  {t("professionals.profile.verified")}
                </span>
              </div>
              <p className="ppp-role">{t(roleLabelKey(profile))}</p>
              {displayBio ? (
                <p className="ppp-bio-inline">{displayBio}</p>
              ) : (
                <p className="ppp-bio-inline ppp-bio-empty">
                  {t("professionals.bio.empty")}
                </p>
              )}
              {location ? <p className="ppp-location">{location}</p> : null}
            </div>
          </div>

          <div className="ppp-side">
            <div className="ppp-stats" aria-label={t("professionals.profile.statsAria")}>
              <div className="ppp-stat">
                <span className="ppp-stat-value">{postsCount}</span>
                <span className="ppp-stat-label">
                  {t("professionals.profile.statPosts")}
                </span>
              </div>
              <div className="ppp-stat">
                <span className="ppp-stat-value">{offersCount}</span>
                <span className="ppp-stat-label">
                  {t("professionals.profile.statOffers")}
                </span>
              </div>
            </div>

            {isOwner ? (
              <div className="ppp-owner-actions">
                <input
                  ref={pictureInputRef}
                  id={pictureInputId}
                  type="file"
                  accept={PROFESSIONAL_PICTURE_ACCEPT}
                  className="ppp-file-input"
                  data-testid="professional-picture-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void onPictureSelected(file);
                  }}
                />
                <button
                  type="button"
                  className="ppp-owner-card"
                  disabled={pictureUploading}
                  aria-busy={pictureUploading || undefined}
                  data-testid="professional-picture-change"
                  onClick={openPicturePicker}
                >
                  <span className="ppp-owner-card-icon" aria-hidden="true">
                    <CameraIcon />
                  </span>
                  <span className="ppp-owner-card-copy">
                    <span className="ppp-owner-card-title">
                      {pictureUploading
                        ? t("professionals.picture.uploading")
                        : t("professionals.picture.changeAction")}
                    </span>
                    <span className="ppp-owner-card-hint">
                      {t("professionals.picture.changeHint")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ppp-owner-card"
                  data-testid="professional-bio-edit-open"
                  onClick={() => {
                    setBioOpen(true);
                    setPictureSuccess(null);
                  }}
                >
                  <span className="ppp-owner-card-icon" aria-hidden="true">
                    <PencilIcon />
                  </span>
                  <span className="ppp-owner-card-copy">
                    <span className="ppp-owner-card-title">
                      {t("professionals.bio.editAction")}
                    </span>
                    <span className="ppp-owner-card-hint">
                      {t("professionals.bio.editHint")}
                    </span>
                  </span>
                </button>
                {pictureError ? (
                  <p className="ppp-picture-error" role="alert">
                    {pictureError}
                  </p>
                ) : null}
                {pictureSuccess ? (
                  <p className="ppp-picture-success" role="status">
                    {pictureSuccess}
                  </p>
                ) : null}
              </div>
            ) : !isAdmin ? (
              <div className="ppp-owner-actions">
                {ready && !authenticated ? (
                  <Link
                    href={loginHref}
                    className="btn-primary ppp-message inline-flex !min-h-11 items-center justify-center"
                    data-testid="professional-contact-login"
                  >
                    {t(messageLabelKey(profile))}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary ppp-message !min-h-11"
                    disabled={starting || !ready}
                    aria-busy={starting || undefined}
                    data-testid="professional-contact"
                    onClick={() => void start(profile.userId, { loginHref })}
                  >
                    {starting
                      ? t("professionals.contact.opening")
                      : t(messageLabelKey(profile))}
                  </button>
                )}
                {contactError ? (
                  <p className="ppp-message-error" role="alert">
                    {contactError}
                  </p>
                ) : null}
                <p className="ppp-owner-card-hint">
                  {t("professionals.profile.visitorHint")}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {(displayBio || profile.phoneNumber) && !isOwner ? (
        <section className="ppp-about" aria-labelledby="ppp-about-title">
          <h2 id="ppp-about-title" className="ppp-about-title">
            {t("professionals.bio.sectionTitle")}
          </h2>
          {displayBio ? (
            <p className="ppp-about-body">{displayBio}</p>
          ) : (
            <p className="ppp-about-body ppp-bio-empty">{t("professionals.bio.empty")}</p>
          )}
          {profile.phoneNumber ? (
            <p className="ppp-about-meta" dir="ltr">
              {profile.phoneNumber}
            </p>
          ) : null}
        </section>
      ) : null}

      {bioOpen && isOwner ? (
        <ProfessionalBioEditor
          initialBio={displayBio}
          onClose={() => setBioOpen(false)}
          onSaved={(next) => {
            setLocalBio(next);
            void reload();
          }}
        />
      ) : null}

      <div className="ppp-toolbar">
        <div
          className="ppp-tabs"
          role="tablist"
          aria-label={t("professionals.tabs.aria")}
        >
          {(
            [
              ["posts", "professionals.tabs.posts"],
              ["offers", "professionals.tabs.offers"],
            ] as const
          ).map(([id, labelKey]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className="ppp-tab"
              data-testid={`professional-tab-${id}`}
              onClick={() => onTabChange(id)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {canManagePosts || canManageOffers ? (
          <div className="ppp-manage">
            {canManagePosts ? (
              <button
                type="button"
                className="btn-primary !min-h-10 px-3.5 text-sm"
                data-testid="professional-post-create-open"
                onClick={() => {
                  setEditingPost(null);
                  setPostFormMode("create");
                  setOfferFormOpen(false);
                  setPostActionSuccess(null);
                  setBioOpen(false);
                }}
              >
                {t("professionals.posts.createAction")}
              </button>
            ) : null}
            {canManageOffers ? (
              <button
                type="button"
                className="btn-outline !min-h-10 px-3.5 text-sm"
                data-testid="professional-offer-create-open"
                onClick={() => {
                  setOfferFormOpen(true);
                  setPostFormMode(null);
                  setEditingPost(null);
                  setOfferActionSuccess(null);
                  setBioOpen(false);
                }}
              >
                {t("professionals.offers.createAction")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {postActionSuccess || offerActionSuccess ? (
        <p className="text-sm font-medium text-[var(--wesal-maroon)]" role="status">
          {offerActionSuccess ?? postActionSuccess}
        </p>
      ) : null}

      {postFormMode ? (
        <ProfessionalPostForm
          mode={postFormMode}
          initialPost={postFormMode === "edit" ? editingPost : null}
          onClose={() => {
            setPostFormMode(null);
            setEditingPost(null);
          }}
          onSaved={() => {
            void refreshAfterPostMutation(postFormMode);
          }}
        />
      ) : null}

      {offerFormOpen ? (
        <ProfessionalOfferForm
          onClose={() => setOfferFormOpen(false)}
          onSaved={() => {
            void refreshAfterOfferMutation("professionals.offers.createSuccess");
          }}
        />
      ) : null}

      {tab === "posts" ? (
        listLoading && posts === null ? (
          <ListLoading />
        ) : listError && tab === "posts" && posts === null ? (
          <ListError message={t(listError)} onRetry={() => void loadTabLists("posts")} />
        ) : (
          <ContentSection
            title={t("professionals.posts.title")}
            empty={t("professionals.posts.empty")}
            items={postsForTab}
            kind="post"
            canEdit={canManagePosts}
            onEdit={(item) => {
              setEditingPost(item);
              setPostFormMode("edit");
              setPostActionSuccess(null);
              setBioOpen(false);
            }}
          />
        )
      ) : null}

      {tab === "offers" ? (
        listLoading && offers === null ? (
          <ListLoading />
        ) : listError && offers === null ? (
          <ListError message={t(listError)} onRetry={() => void loadTabLists("offers")} />
        ) : (
          <ContentSection
            title={t("professionals.offers.title")}
            empty={
              canManageOffers
                ? t("professionals.offers.emptyOwner")
                : t("professionals.offers.empty")
            }
            items={offersForTab}
            kind="offer"
            canStop={canManageOffers}
            onStop={onStopOffer}
            showLifecycle={canManageOffers}
          />
        )
      ) : null}
    </div>
  );
}

function ContentSection({
  title,
  empty,
  items,
  kind,
  canEdit = false,
  onEdit,
  canStop = false,
  onStop,
  showLifecycle = false,
}: {
  title: string;
  empty: string;
  items: ProfessionalProfileContentItem[];
  kind: "post" | "offer";
  canEdit?: boolean;
  onEdit?: (item: ProfessionalProfileContentItem) => void;
  canStop?: boolean;
  onStop?: (item: ProfessionalProfileContentItem) => Promise<void> | void;
  showLifecycle?: boolean;
}) {
  return (
    <section className="ppp-section">
      <h2 className="ppp-section-title">{title}</h2>
      {items.length === 0 ? (
        <p className="ppp-section-empty">{empty}</p>
      ) : (
        <div className="ppp-grid">
          {items.map((item) => (
            <ProfessionalContentCard
              key={item.id}
              item={item}
              kind={kind}
              canEdit={canEdit}
              onEdit={onEdit}
              canStop={canStop}
              onStop={onStop}
              showLifecycle={showLifecycle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ListLoading() {
  return (
    <div
      className="h-40 animate-pulse rounded-3xl bg-white/80"
      aria-busy="true"
      data-testid="professional-content-loading"
    />
  );
}

function ListError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <section className="rounded-3xl bg-white p-5 text-center" role="alert">
      <p className="text-sm text-[var(--wesal-muted)]">{message}</p>
      <button type="button" className="btn-outline mt-4" onClick={onRetry}>
        {t("common.retry")}
      </button>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L9 10.94 7.28 9.22a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 3.487a2.1 2.1 0 113.0 2.95L7.5 18.8 3 20l1.2-4.5L16.862 3.487z"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8.5A2.5 2.5 0 016.5 6h1.2l1.1-1.6A1.5 1.5 0 0110.05 3.5h3.9a1.5 1.5 0 011.25.9L16.3 6h1.2A2.5 2.5 0 0120 8.5v9A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-9z"
      />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  );
}
