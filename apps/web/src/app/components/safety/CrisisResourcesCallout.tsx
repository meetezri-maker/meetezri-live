import { Link } from 'react-router-dom';
import { ChevronRight, Phone } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface CrisisResourcesCalloutProps {
  className?: string;
}


/**
 * “Helpful resources” strip: gradient banner + frosted preview tiles, links to full crisis directory.
 */
export function CrisisResourcesCallout({ className }: CrisisResourcesCalloutProps) {
  return (
    <section
      aria-labelledby="crisis-resources-callout-heading"
      className={
        
        'rounded-xl p-6 mt-6 bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-xl'
      }
    >
      <div className="p-2">
        {/* Header — matches reference: phone + title on gradient */}
        <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-6">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"
            aria-hidden
          >
            <Phone className="size-6 text-white" strokeWidth={1.75} />
          </div>
          <h2
            id="crisis-resources-callout-heading"
            className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl"
          >
            Helpful Resources — Available 24/7
          </h2>
        </div>

        {/* Frosted sub-cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        
        </div>

        {/* Primary navigation — full crisis directory */}
        <Link
          to="/app/crisis-resources"
          className={cn(
            'group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40',
            'bg-white px-4 py-3.5 text-center text-sm font-semibold text-red-600',
            'shadow-md transition hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-500',
            'dark:text-red-700',
          )}
        >
          <span>Emergency Resources </span>
          <ChevronRight
            className="size-5 shrink-0 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
       
      </div>
    </section>
  );
}
