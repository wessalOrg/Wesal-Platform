import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import dynamic from "next/dynamic";

const HomeCategoriesSection = dynamic(
  () => import("@/components/home/HomeCategoriesSection"),
);
const FeaturedHallsSection = dynamic(
  () => import("@/components/home/FeaturedHallsSection"),
);
const OccasionServicesSection = dynamic(
  () => import("@/components/home/OccasionServicesSection"),
);
const HowItWorksSection = dynamic(
  () => import("@/components/home/HowItWorksSection"),
);
const StorySection = dynamic(() => import("@/components/home/StorySection"));

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
      </main>
      <Footer />
    </>
  );
}
