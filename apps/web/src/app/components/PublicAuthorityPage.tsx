import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicFooter } from "./PublicFooter";
import { PublicNav } from "./PublicNav";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingGlowCard, type LandingGlowVariant } from "../landing/LandingGlowCard";
import { LandingHeroScene } from "../landing/LandingHeroScene";

export interface PublicAuthorityLink {
  href: string;
  label: string;
  primary?: boolean;
}

export interface PublicAuthoritySection {
  title: string;
  paragraphs: readonly string[];
  points?: readonly string[];
  links?: readonly PublicAuthorityLink[];
  glow?: LandingGlowVariant;
}

export interface PublicAuthorityPageProps {
  eyebrow: string;
  title: string;
  lead: string;
  summary: string;
  notice?: { title: string; body: string };
  heroImage?: { src: string; alt: string };
  sections: readonly PublicAuthoritySection[];
  cta: { title: string; body: string; links: readonly PublicAuthorityLink[] };
}

function AuthorityLinks({ links }: { links: readonly PublicAuthorityLink[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Link
          key={`${link.href}-${link.label}`}
          to={link.href}
          className={
            link.primary
              ? "landing-cta-glow inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-3 text-sm font-semibold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.09] hover:text-white"
          }
        >
          {link.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

export function PublicAuthorityPage({
  eyebrow,
  title,
  lead,
  summary,
  notice,
  heroImage,
  sections,
  cta,
}: PublicAuthorityPageProps) {
  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />
      <div className="relative z-10">
        <PublicNav variant="cinematic" />
        <main>
          <LandingHeroScene>
            <div className="landing-section grid items-center gap-10 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="max-w-3xl">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200/85">
                  {eyebrow}
                </p>
                <h1 className="landing-serif text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
                  {title}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/88 sm:text-xl">{lead}</p>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--solace-ds-text-muted)]">
                  {summary}
                </p>
              </div>
              <LandingGlowCard glow="purple" className="overflow-hidden p-6 sm:p-8">
                {heroImage ? (
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    className="mb-6 aspect-[16/10] w-full rounded-2xl object-cover"
                    width={1200}
                    height={750}
                  />
                ) : null}
                <p className="landing-serif text-2xl leading-snug text-white sm:text-3xl">{summary}</p>
              </LandingGlowCard>
            </div>
          </LandingHeroScene>

          {notice ? (
            <section className="landing-section py-8" aria-labelledby="authority-notice-title">
              <LandingGlowCard glow="amber" className="p-6 sm:p-8">
                <h2 id="authority-notice-title" className="text-xl font-semibold text-white">
                  {notice.title}
                </h2>
                <p className="mt-3 max-w-4xl text-base leading-relaxed text-white/80">{notice.body}</p>
              </LandingGlowCard>
            </section>
          ) : null}

          <section className="landing-section py-12 md:py-16" aria-label={`${title} details`}>
            <div className="grid gap-5 md:grid-cols-2">
              {sections.map((section) => (
                <LandingGlowCard key={section.title} glow={section.glow ?? "purple"} className="p-6 sm:p-8">
                  <h2 className="landing-serif text-2xl font-semibold text-white sm:text-3xl">{section.title}</h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                  {section.points ? (
                    <ul className="mt-5 space-y-3">
                      {section.points.map((point) => (
                        <li key={point} className="flex gap-3 text-sm leading-relaxed text-white/78">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.links ? <div className="mt-6"><AuthorityLinks links={section.links} /></div> : null}
                </LandingGlowCard>
              ))}
            </div>
          </section>

          <section className="landing-section pb-16 pt-4 md:pb-24">
            <LandingGlowCard glow="pink" className="flex flex-col items-start gap-5 p-7 sm:p-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="landing-serif text-3xl font-semibold text-white">{cta.title}</h2>
                <p className="mt-3 leading-relaxed text-[var(--solace-ds-text-muted)]">{cta.body}</p>
              </div>
              <AuthorityLinks links={cta.links} />
            </LandingGlowCard>
          </section>
        </main>
        <PublicFooter />
      </div>
    </div>
  );
}
