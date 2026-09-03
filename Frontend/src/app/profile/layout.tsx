import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import ProfileRouteSync from "@/components/profile/ProfileRouteSync";
import RegularUserProfileGuard from "@/components/profile/RegularUserProfileGuard";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[60svh] bg-[var(--wesal-pink)] py-8 sm:py-12">
        <div className="container-wesal">
          <RegularUserProfileGuard>
            <ProfileRouteSync />
            {children}
          </RegularUserProfileGuard>
        </div>
      </main>
      <Footer />
    </>
  );
}
