import { useEffect } from "react";
import { PublicFooter } from "../components/PublicFooter";
import { FoundingMemberSignupProvider } from "../features/prelaunch/FoundingMemberSignupContext";
import { PrelaunchNav } from "../features/prelaunch/PrelaunchNav";
import { usePrelaunchMeta } from "../features/prelaunch/usePrelaunchMeta";
import { resolvePrelaunchAttribution } from "../features/prelaunch/prelaunch.attribution";
import { trackPrelaunchEvent } from "../features/prelaunch/prelaunch.analytics";
import { HeroSection } from "../features/prelaunch/sections/HeroSection";
import { RecognitionSection } from "../features/prelaunch/sections/RecognitionSection";
import { MeetSolaceSection } from "../features/prelaunch/sections/MeetSolaceSection";
import { EverydayMomentsSection } from "../features/prelaunch/sections/EverydayMomentsSection";
import { SolaceExperienceSection } from "../features/prelaunch/sections/SolaceExperienceSection";
import { PurposeSection } from "../features/prelaunch/sections/PurposeSection";
import { FounderSection } from "../features/prelaunch/sections/FounderSection";
import { FoundingCircleSection } from "../features/prelaunch/sections/FoundingCircleSection";
import { TrustSection } from "../features/prelaunch/sections/TrustSection";
import { FaqSection } from "../features/prelaunch/sections/FaqSection";
import { FinalInvitationSection } from "../features/prelaunch/sections/FinalInvitationSection";

/**
 * Solace Pre-Launch Founding Member landing page (`/early-access`).
 *
 * A standalone campaign destination for paid ads. It collects an email for the
 * Founding Circle — it does not create an application account, and it never
 * routes the visitor into the app.
 *
 * The eleven sections below are ordered exactly as the approved content
 * document specifies; the order is asserted in `prelaunch.structure.test.tsx`.
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
    <div className="solace-landing relative min-h-screen overflow-x-hidden bg-[#050816]">
      <FoundingMemberSignupProvider>
        <PrelaunchNav />

        <main>
          <HeroSection />
          <RecognitionSection />
          <MeetSolaceSection />
          <EverydayMomentsSection />
          <SolaceExperienceSection />
          <PurposeSection />
          <FounderSection />
          <FoundingCircleSection />
          <TrustSection />
          <FaqSection />
          <FinalInvitationSection />
        </main>

        <PublicFooter />
      </FoundingMemberSignupProvider>
    </div>
  );
}
