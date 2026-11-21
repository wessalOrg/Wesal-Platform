"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfessionalPostForm from "@/components/professionals/ProfessionalPostForm";
import PublishingRestrictionBanner from "@/components/moderation/PublishingRestrictionBanner";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import OfferManageIcon from "@/components/offers/OfferManageIcon";
import PostEditorIcon from "./PostEditorIcon";
import "./professional-posts-manage.css";
import { useUserProfileStore } from "@/components/profile/UserProfileProvider";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useAccountPublishingLock } from "@/hooks/useAccountPublishingLock";
import { useT } from "@/i18n";
import { fetchProfessionalProfilePosts } from "@/services/professional-profile";
import type { ProfessionalProfileContentItem, ProfessionalProfileContentPage } from "@/types/professional-profile";

type LoadedPosts = {
  key: string;
  result: ProfessionalProfileContentPage | null;
  failed: boolean;
};

export default function ProfessionalPostsManagePage() {
  const t = useT();
  const lang = useUiLang();
  const access = useProfessionalAccountAccess();
  const profileStore = useUserProfileStore();
  const publishingLock = useAccountPublishingLock();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<LoadedPosts | null>(null);
  const [form, setForm] = useState<{
    owner: string;
    post: ProfessionalProfileContentItem | null;
  } | null>(null);
  const [success, setSuccess] = useState<{ owner: string; key: string } | null>(null);
  const ownerId = access.userId || access.profile?.id || "";
  const owner = access.sessionKey || "";
  const requestKey = `${owner}|${page}|${revision}`;
  const canRead = access.ready && access.authenticated && access.isProfessional &&
    access.profileStatus === "ready" && Boolean(ownerId);
  const isLocked = Boolean(access.profile?.isLocked || publishingLock.isLocked);
  const canPublish = access.canPublish && publishingLock.ready && !isLocked;
  const activeForm = form?.owner === owner && canPublish ? form : null;
  const current = loaded?.key === requestKey ? loaded : null;
  const posts = current?.result?.items ?? [];

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    void fetchProfessionalProfilePosts(ownerId, page, 12)
      .then((result) => {
        if (active) setLoaded({ key: requestKey, result, failed: false });
      })
      .catch(() => {
        if (active) setLoaded({ key: requestKey, result: null, failed: true });
      });
    return () => { active = false; };
  }, [canRead, ownerId, page, requestKey]);

  const openForm = (post: ProfessionalProfileContentItem | null = null) => {
    if (!canPublish) return;
    setSuccess(null);
    setForm({ owner, post });
  };

  if (!access.ready || access.statusLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white" aria-busy="true" />;
  }

  if (!access.isProfessional) {
    return <p className="seeker-settings-card" role="alert">{t("dashboard.posts.professionalOnly")}</p>;
  }

  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  return (
    <div className="space-y-5" data-testid="professional-posts-page">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-5 sm:p-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-[var(--wesal-maroon-dark)]">{t("professionals.posts.title")}</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">{t("dashboard.posts.subtitle")}</p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 !min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canPublish || Boolean(activeForm)}
          onClick={() => openForm()}
          data-testid="dashboard-post-create"
        >
          <span aria-hidden="true" className="text-xl">+</span>
          {t("dashboard.posts.create")}
        </button>
      </header>

      {access.profileStatus === "error" ? (
        <div className="seeker-settings-card" role="alert">
          <p>{t("professionals.posts.errors.loadFailed")}</p>
          <button type="button" className="btn-outline mt-3" onClick={() => void profileStore.refetch()}>{t("common.retry")}</button>
        </div>
      ) : !access.canPublish ? (
        <p className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-4 text-sm leading-7" data-testid="dashboard-posts-approval-required">
          {t("dashboard.posts.approvalRequired")}
        </p>
      ) : null}

      {isLocked ? <PublishingRestrictionBanner lockedUntil={access.profile?.lockedUntil || publishingLock.lockedUntil} /> : null}

      {success?.owner === owner ? (
        <p className="rounded-xl bg-[var(--wesal-pink)] p-3 text-sm text-[var(--wesal-maroon-dark)]" role="status">{t(success.key)}</p>
      ) : null}

      {activeForm ? (
        <ProfessionalPostForm
          key={activeForm.post?.id ?? "new"}
          mode={activeForm.post ? "edit" : "create"}
          initialPost={activeForm.post}
          onClose={() => setForm(null)}
          onSaved={() => {
            setSuccess({ owner, key: activeForm.post ? "professionals.posts.updateSuccess" : "professionals.posts.createSuccess" });
            setPage(1);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}

      {canRead ? (
        <section className="space-y-4" aria-label={t("professionals.posts.title")}>
          <h2 className="text-lg font-bold text-[var(--wesal-text)]">
            {t("dashboard.posts.total", { count: current?.result?.totalCount ?? "…" })}
          </h2>
          {!current ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" data-testid="dashboard-posts-loading">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-60 animate-pulse rounded-2xl bg-white" />)}
            </div>
          ) : current.failed ? (
            <div className="seeker-settings-card" role="alert" data-testid="dashboard-posts-error">
              <p>{t("professionals.posts.errors.loadFailed")}</p>
              <button type="button" className="btn-outline mt-3" onClick={() => setRevision((value) => value + 1)}>{t("common.retry")}</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white px-5 py-12 text-center" data-testid="dashboard-posts-empty">
              <h3 className="font-bold text-[var(--wesal-maroon-dark)]">{t("dashboard.posts.emptyTitle")}</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--wesal-muted)]">{t("dashboard.posts.emptyBody")}</p>
              {canPublish && !activeForm ? <button type="button" className="btn-outline mt-5" onClick={() => openForm()}>{t("dashboard.posts.create")}</button> : null}
            </div>
          ) : (
            <div className="professional-posts-list">
              {posts.map((post) => (
                <article key={post.id} className="professional-post-row" data-testid="dashboard-post-card">
                  <div className="professional-post-row-image">
                    {post.images[0] ? (
                      <AuthenticatedApiImage src={post.images[0].url} alt={post.content || t("posts.untitled")} className="h-full w-full object-cover" fallback={<PostEditorIcon name="image" />} />
                    ) : <PostEditorIcon name="document" />}
                  </div>
                  <div className="professional-post-row-details">
                    {post.createdAt && Number.isFinite(Date.parse(post.createdAt)) ? (
                      <time dateTime={post.createdAt} className="text-xs text-[var(--wesal-muted)]">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(post.createdAt))}</time>
                    ) : null}
                    <p className="professional-post-row-content">{post.content || t("posts.untitled")}</p>
                    {post.price != null ? <p className="professional-post-row-price">{new Intl.NumberFormat(locale, { style: "currency", currency: "ILS" }).format(post.price)}</p> : null}
                  </div>
                  <div className="professional-post-row-actions">
                    <Link href={`/posts/${encodeURIComponent(post.id)}`} className="professional-post-row-action" aria-label={t("dashboard.posts.view")} title={t("dashboard.posts.view")}><OfferManageIcon name="view" /></Link>
                    <button type="button" className="professional-post-row-action" aria-label={t("professionals.posts.editAction")} title={t("professionals.posts.editAction")} disabled={!canPublish} onClick={() => openForm(post)}><OfferManageIcon name="edit" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {(current?.result?.totalPages ?? 0) > 1 ? (
            <nav className="flex flex-wrap items-center justify-center gap-3" aria-label={t("professionals.posts.title")}>
              <button type="button" className="btn-outline !min-h-10" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("dashboard.posts.previous")}</button>
              <span className="text-sm text-[var(--wesal-muted)]">{t("dashboard.posts.page", { page, total: current!.result!.totalPages })}</span>
              <button type="button" className="btn-outline !min-h-10" disabled={page >= current!.result!.totalPages} onClick={() => setPage((value) => value + 1)}>{t("dashboard.posts.next")}</button>
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
