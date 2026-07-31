import { useEffect } from "react";
import { EarlyAccessFooter } from "../components/EarlyAccessFooter";
import { FoundingMemberSignupProvider } from "../features/prelaunch/FoundingMemberSignupContext";
import { PrelaunchNav } from "../features/prelaunch/PrelaunchNav";
import { usePrelaunchMeta } from "../features/prelaunch/usePrelaunchMeta";
import { resolvePrelaunchAttribution } from "../features/prelaunch/prelaunch.attribution";
import { trackPrelaunchEvent } from "../features/prelaunch/prelaunch.analytics";
import { HeroSection } from "../features/prelaunch/sections/HeroSection";
import { HumanMomentsSection } from "../features/prelaunch/sections/HumanMomentsSection";
import { TalkItOutSection } from "../features/prelaunch/sections/TalkItOutSection";
import { YourJourneySection } from "../features/prelaunch/sections/YourJourneySection";
import { FounderSection } from "../features/prelaunch/sections/FounderSection";
import { FoundingCircleSection } from "../features/prelaunch/sections/FoundingCircleSection";
import { TrustSection } from "../features/prelaunch/sections/TrustSection";
import { FaqSection } from "../features/prelaunch/sections/FaqSection";

/**
 * Solace Pre-Launch Founding Member landing page (`/early-access`).
 *
 * A standalone campaign destination for paid ads. It collects an email for the
 * Founding Circle — it does not create an application account, and it never
 * routes the visitor into the app.
 *
 * Sections are ordered exactly as the approved documents specify; the order is
 * asserted in `prelaunch.structure.test.tsx`.
 */
export function EarlyAccess() {
  usePrelaunchMeta();

  useEffect(() => {
    // Captures UTM values once per visit and stores them for the session, so the
    // signup form still has attribution if the visitor converts much later.
    const attribution = resolvePrelaunchAttribution();
    trackPrelaunchEvent("prelaunch_landing_viewed", {
      utm_source: attribution.utmSource,
      utm_medium: attribution.utmMedium,
      utm_campaign: attribution.utmCampaign,
    });
  }, []);

  return (
    <div className="solace-landing landing-reduced-motion relative min-h-screen overflow-x-hidden bg-[#050816]">
      <FoundingMemberSignupProvider>
        <PrelaunchNav />

        <main>
          <HeroSection />
          <HumanMomentsSection />
          <TalkItOutSection />
          <YourJourneySection />
          {/* The founder story carries the page's "about" intent. */}
          <FounderSection />
          <FoundingCircleSection />
          <TrustSection />
          {/* The final invitation is folded into the end of the FAQ. */}
          <FaqSection />
        </main>

        <EarlyAccessFooter />
      </FoundingMemberSignupProvider>
    </div>
  );
}
