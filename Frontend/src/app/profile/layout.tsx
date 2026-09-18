import ProfileRouteSync from "@/components/profile/ProfileRouteSync";
import RegularUserProfileGuard from "@/components/profile/RegularUserProfileGuard";
import SeekerDashboardShell from "@/components/seeker-dashboard/SeekerDashboardShell";

/** App-shell profile portal (no public navbar/footer — CareLink-style workspace). */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seeker-app">
      <RegularUserProfileGuard>
        <ProfileRouteSync />
        <SeekerDashboardShell>{children}</SeekerDashboardShell>
      </RegularUserProfileGuard>
    </div>
  );
}
