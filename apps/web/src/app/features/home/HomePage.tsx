import { useEffect } from "react";
import { useLocation } from "react-router";
import { MotionConfig } from "motion/react";
import HomeNavbar from "./components/HomeNavbar";
import HeroSection from "./components/HeroSection";
import EverydaySection from "./components/EverydaySection";
import FeaturesSection from "./components/FeaturesSection";
import MomentsSection from "./components/MomentsSection";
import HowItWorksSection from "./components/HowItWorksSection";
import EverydayLifeSection from "./components/EverydayLifeSection";
import JourneySection from "./components/JourneySection";
import FounderSection from "./components/FounderSection";
import ConversationSection from "./components/ConversationSection";
import PricingSection from "./components/PricingSection";
import FaqSection from "./components/FaqSection";
import HomeFooter from "./components/HomeFooter";
import { useHomeFonts } from "./homeFonts";
import { HOME_SECTION_IDS, scrollToSection } from "./scroll";

/**
 * The designer homepage, served at `/landing-page` for review (noindex). Every section is
 * imported statically so the page also renders completely with `renderToString`.
 */
export function HomePage() {
  const { hash } = useLocation();
  useHomeFonts();

  // Section deep links such as `/landing-page#pricing`.
  useEffect(() => {
    const target = decodeURIComponent(hash.replace(/^#/, ""));
    if (!(HOME_SECTION_IDS as readonly string[]).includes(target)) return;
    const timer = window.setTimeout(() => scrollToSection(target, { updateHash: false }), 100);
    return () => window.clearTimeout(timer);
  }, [hash]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="solace-home relative min-h-full w-full overflow-x-clip bg-white">
        <a href="#home-main" className="solace-home-skip-link">
          Skip to main content
        </a>
        <HomeNavbar />
        <main id="home-main">
          <HeroSection />
          <EverydaySection />
          <FeaturesSection />
          <MomentsSection />
          <HowItWorksSection />
          <EverydayLifeSection />
          <JourneySection />
          <FounderSection />
          <ConversationSection />
          <PricingSection />
          <FaqSection />
        </main>
        <HomeFooter />
      </div>
    </MotionConfig>
  );
}
