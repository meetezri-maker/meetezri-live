import { Link } from 'react-router-dom';
import {
  Heart,
  ChevronRight,
  Phone,
  BookOpen,
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  wellnessPlanRailCard,
  wellnessPlanRailActionRow,
  WELLNESS_PLAN_HERO_IMG,
  WELLNESS_PLAN_BANNER_IMG,
} from '@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi';
import { EngagementRing } from './ResourceAnalyticsVisuals';

interface ResourceAnalyticsRailProps {
  engagementLabel: string;
  engagementPercent: number;
  mostUsedCategory: string;
  supportConsistencyDays: number;
  emotionalEngagement: string;
}

export function ResourceAnalyticsRail({
  engagementLabel,
  engagementPercent,
  mostUsedCategory,
  supportConsistencyDays,
  emotionalEngagement,
}: ResourceAnalyticsRailProps) {
  return (
    <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start xl:space-y-6">
      {/* 1. Your Wellness Trends */}
      <section className={wellnessPlanRailCard}>
        <h2 className="font-serif text-lg font-light text-white">Your Wellness Trends</h2>
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="relative">
            <EngagementRing percent={engagementPercent} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart className="h-6 w-6 text-fuchsia-300/85" aria-hidden />
            </div>
          </div>
          <p className="text-center text-sm font-medium text-fuchsia-200/90">{engagementLabel}</p>
          <p className="text-center text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
            You&apos;re actively using support resources and building healthy habits.
          </p>
        </div>
        <ul className="mt-5 space-y-3 border-t border-white/[0.06] pt-4">
          <li className="flex items-start justify-between gap-2 text-xs">
            <span className="text-[rgba(255,255,255,0.45)]">Most used category</span>
            <span className="text-right font-medium text-[rgba(255,255,255,0.82)]">
              {mostUsedCategory}
            </span>
          </li>
          <li className="flex items-start justify-between gap-2 text-xs">
            <span className="text-[rgba(255,255,255,0.45)]">Support consistency</span>
            <span className="text-right font-medium text-[rgba(255,255,255,0.82)]">
              {supportConsistencyDays > 0
                ? `${supportConsistencyDays} day${supportConsistencyDays === 1 ? '' : 's'} this week`
                : 'Not enough data yet'}
            </span>
          </li>
          <li className="flex items-start justify-between gap-2 text-xs">
            <span className="text-[rgba(255,255,255,0.45)]">Emotional engagement</span>
            <span className="text-right font-medium text-[rgba(255,255,255,0.82)]">
              {emotionalEngagement}
            </span>
          </li>
        </ul>
      </section>

      {/* 2. Support Reminder */}
      <section
        className={cn(
          wellnessPlanRailCard,
          'relative overflow-hidden border-fuchsia-400/12 p-0'
        )}
      >
        <img
          src={WELLNESS_PLAN_BANNER_IMG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          width={400}
          height={240}
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,11,24,0.55)_0%,rgba(10,11,24,0.92)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(236,72,153,0.22),transparent_60%)]"
          aria-hidden
        />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-300/90" aria-hidden />
            <h2 className="font-serif text-lg font-light text-white">Support Reminder</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.72)]">
            Even small moments of support matter.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-rose-200/75">
            You&apos;re doing a great job prioritizing your wellbeing.
          </p>
        </div>
      </section>

      {/* 3. Quick Access */}
      <section className={wellnessPlanRailCard}>
        <h2 className="font-serif text-lg font-light text-white">Quick Access</h2>
        <nav className="mt-4 space-y-2" aria-label="Quick access">
          <Link to="/app/emergency-resources" className={wellnessPlanRailActionRow}>
            <Phone className="h-4 w-4 shrink-0 text-violet-300/90" aria-hidden />
            <span className="flex-1">Emergency Resources</span>
            <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.35)]" aria-hidden />
          </Link>
          <Link to="/app/wellness-tools" className={wellnessPlanRailActionRow}>
            <BookOpen className="h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
            <span className="flex-1">Resource Library</span>
            <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.35)]" aria-hidden />
          </Link>
          <Link to="/app/settings/wellness-plan" className={wellnessPlanRailActionRow}>
            <Shield className="h-4 w-4 shrink-0 text-emerald-300/90" aria-hidden />
            <span className="flex-1">Safety Plan</span>
            <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.35)]" aria-hidden />
          </Link>
        </nav>
      </section>

      {/* 4. You Are Not Alone */}
      <section
        className={cn(
          wellnessPlanRailCard,
          'relative overflow-hidden border-rose-400/14 p-0'
        )}
      >
        <img
          src={WELLNESS_PLAN_HERO_IMG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[72%_38%] opacity-45"
          width={400}
          height={240}
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(165deg,rgba(88,28,135,0.45)_0%,rgba(10,11,24,0.88)_55%,rgba(10,11,24,0.96)_100%)]"
          aria-hidden
        />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300/85" aria-hidden />
            <h2 className="font-serif text-lg font-light text-white">You Are Not Alone</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.68)]">
            You&apos;re building healthier support habits one step at a time.
          </p>
          <p className="mt-2 text-sm font-medium text-rose-200/80">We&apos;re here for you 24/7.</p>
        </div>
      </section>
    </aside>
  );
}
