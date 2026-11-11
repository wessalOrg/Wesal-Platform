"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicProfileOffersSection from "@/components/offers/PublicProfileOffersSection";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatOfferAmount } from "@/lib/offer-format";
import { fetchPublicProfessionalProfile } from "@/services/public-profile";
import type { PublicProfessionalProfile } from "@/types/posts";

type PublicProfessionalProfileViewProps = {
  userId: string;
};

export default function PublicProfessionalProfileView({
  userId,
}: PublicProfessionalProfileViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [profile, setProfile] = useState<PublicProfessionalProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void fetchPublicProfessionalProfile(userId)
      .then((row) => {
        if (cancelled) return;
        setProfile(row);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (status === "loading") {
    return <p className="text-sm text-[var(--wesal-muted)]">{t("posts.profile.loading")}</p>;
  }
  if (status === "error" || !profile) {
    return (
      <p className="text-sm text-[#b42318]" role="alert">
        {t("posts.profile.errors.loadFailed")}
      </p>
    );
  }

  const title =
    profile.displayName ||
    profile.shopName ||
    profile.studioName ||
    t("posts.profile.untitled");

  return (
    <div className="space-y-6" data-testid="public-professional-profile">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-pink)] text-xl font-extrabold text-[var(--wesal-maroon)]">
          {profile.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePictureUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)]">
            {title}
          </h1>
          {profile.role ? (
            <p className="mt-0.5 text-xs font-bold text-[var(--wesal-maroon)]">
              {profile.role}
            </p>
          ) : null}
          {profile.bio ? (
            <p className="mt-2 text-sm text-[var(--wesal-muted)]">{profile.bio}</p>
          ) : null}
          {profile.shopLocation || profile.studioLocation ? (
            <p className="mt-1 text-xs text-[var(--wesal-muted)]">
              {profile.shopLocation || profile.studioLocation}
            </p>
          ) : null}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("posts.profile.posts")}
        </h2>
        {profile.posts.length === 0 ? (
          <p className="text-sm text-[var(--wesal-muted)]">{t("posts.profile.noPosts")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${encodeURIComponent(post.id)}`}
                className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-[var(--wesal-pink)]">
                  {post.images[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.images[0].url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-bold text-[var(--wesal-maroon-dark)]">
                    {post.content?.trim() || t("posts.untitled")}
                  </p>
                  {post.price != null ? (
                    <p className="text-xs font-bold text-[var(--wesal-maroon)]">
                      {formatOfferAmount(post.price, locale)} {t("offers.currency")}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <PublicProfileOffersSection userId={userId} />
    </div>
  );
}
