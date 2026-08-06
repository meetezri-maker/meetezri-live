/**
 * Publish checklist — READ-ONLY.
 *
 * The server is the only authority on these rules (it re-runs them inside every publish
 * transaction). This component displays the result and never re-implements a rule, so the UI
 * cannot drift from what publishing will actually enforce.
 *
 * Icons are paired with text: a failing item reads "Failed", not just a red mark.
 */

import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentHubChecklist, ContentHubChecklistItem } from "@/lib/api";

function itemState(item: ContentHubChecklistItem): "passed" | "failed" | "warning" {
  if (item.passed) return "passed";
  return item.blocking ? "failed" : "warning";
}

const STATE_TEXT = { passed: "Passed", failed: "Failed", warning: "Warning" } as const;

function ChecklistRow({ item }: { item: ContentHubChecklistItem }) {
  const state = itemState(item);

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          state === "passed" && "bg-emerald-400/15 text-emerald-300",
          state === "failed" && "bg-red-400/15 text-red-300",
          state === "warning" && "bg-amber-400/15 text-amber-300",
        )}
      >
        {state === "passed" ? (
          <Check className="h-3 w-3" />
        ) : state === "failed" ? (
          <X className="h-3 w-3" />
        ) : (
          <AlertTriangle className="h-3 w-3" />
        )}
      </span>

      <span className="min-w-0 flex-1 text-sm">
        <span className="text-[var(--admin-text)]">{item.label}</span>
        {/* State in text, so the icon is never the only signal. */}
        <span className="sr-only"> — {STATE_TEXT[state]}</span>
        {!item.passed ? (
          <span
            className={cn(
              "ml-2 text-xs",
              state === "failed" ? "text-red-300" : "text-amber-300",
            )}
          >
            {state === "failed" ? "Blocking" : "Warning"}
          </span>
        ) : null}
        {item.details ? (
          // Server-supplied and already safe — it never contains content values.
          <span className="mt-0.5 block text-xs text-[var(--admin-text-muted)]">{item.details}</span>
        ) : null}
      </span>
    </li>
  );
}

export interface ChecklistPanelProps {
  checklist: ContentHubChecklist | undefined;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

export function ChecklistPanel({ checklist, isLoading, isError, className }: ChecklistPanelProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 py-4 text-sm text-[var(--admin-text-secondary)]", className)}>
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        <span role="status">Loading checklist…</span>
      </div>
    );
  }

  if (isError || !checklist) {
    return (
      <p role="alert" className={cn("py-4 text-sm text-[var(--admin-text-secondary)]", className)}>
        Could not load the publish checklist.
      </p>
    );
  }

  const blocking = checklist.items.filter((i) => i.blocking);
  const warnings = checklist.items.filter((i) => !i.blocking);
  const failedCount = blocking.filter((i) => !i.passed).length;

  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-[var(--admin-text)]">
        {checklist.passed
          ? "Ready to publish"
          : `${failedCount} blocking ${failedCount === 1 ? "item" : "items"} outstanding`}
      </p>

      <ul className="divide-y divide-white/[0.04]">
        {blocking.map((item) => (
          <ChecklistRow key={item.code} item={item} />
        ))}
      </ul>

      {warnings.length > 0 ? (
        <>
          <p className="mt-3 mb-1 text-xs uppercase tracking-wide text-[var(--admin-text-muted)]">
            Warnings — these do not block publishing
          </p>
          <ul className="divide-y divide-white/[0.04]">
            {warnings.map((item) => (
              <ChecklistRow key={item.code} item={item} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
