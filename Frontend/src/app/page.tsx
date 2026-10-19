import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import HomeCategoriesSection from "@/components/home/HomeCategoriesSection";
import FeaturedHallsSection from "@/components/home/FeaturedHallsSection";
import dynamic from "next/dynamic";

const OccasionServicesSection = dynamic(
  () => import("@/components/home/OccasionServicesSection"),
);
const HowItWorksSection = dynamic(
  () => import("@/components/home/HowItWorksSection"),
);
const StorySection = dynamic(() => import("@/components/home/StorySection"));
const ConsultSection = dynamic(() => import("@/components/home/ConsultSection"));

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HomeCategoriesSection />
        <FeaturedHallsSection />
        <OccasionServicesSection />
        <HowItWorksSection />
        <StorySection />
        <ConsultSection />
      </main>
      <Footer />
    </>
  );
}
