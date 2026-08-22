import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import FeaturedHallsSection from "@/components/home/FeaturedHallsSection";
import dynamic from "next/dynamic";

const HowItWorksSection = dynamic(
  () => import("@/components/home/HowItWorksSection"),
);
const OwnerCtaSection = dynamic(
  () => import("@/components/home/OwnerCtaSection"),
);
const BenefitsSection = dynamic(
  () => import("@/components/home/BenefitsSection"),
);

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturedHallsSection />
        <HowItWorksSection />
        <OwnerCtaSection />
        <BenefitsSection />
      </main>
      <Footer />
    </>
  );
}
