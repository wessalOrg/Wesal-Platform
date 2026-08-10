import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Reveal from "@/components/ui/Reveal";
import HeroSection from "@/components/home/HeroSection";
import FeaturedHallsSection from "@/components/home/FeaturedHallsSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import BenefitsSection from "@/components/home/BenefitsSection";
import OwnerCtaSection from "@/components/home/OwnerCtaSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <Reveal as="div">
          <FeaturedHallsSection />
        </Reveal>
        <Reveal as="div">
          <HowItWorksSection />
        </Reveal>
        <Reveal as="div">
          <OwnerCtaSection />
        </Reveal>
        <Reveal as="div">
          <BenefitsSection />
        </Reveal>
      </main>
      <Reveal as="div">
        <Footer />
      </Reveal>
    </>
  );
}
