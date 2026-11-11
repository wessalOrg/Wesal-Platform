import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PostDetailsView from "@/components/posts/PostDetailsView";
import { translate } from "@/i18n";

type PageProps = {
  params: Promise<{ postId: string }> | { postId: string };
};

export const metadata: Metadata = {
  title: translate("meta.postTitle", "ar"),
  description: translate("meta.postDescription", "ar"),
};

export default async function PostDetailsPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const postId = decodeURIComponent(resolved.postId);

  return (
    <>
      <Navbar />
      <main className="min-h-[60svh] bg-[var(--wesal-cream)]">
        <div className="container-wesal py-6 sm:py-8">
          <Suspense
            fallback={
              <p className="text-sm text-[var(--wesal-muted)]">
                {translate("posts.loading", "ar")}
              </p>
            }
          >
            <PostDetailsView postId={postId} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
