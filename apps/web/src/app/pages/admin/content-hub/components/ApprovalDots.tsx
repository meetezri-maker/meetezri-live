/**
 * Approval summary.
 *
 * ITERATES `APPROVAL_GATES` — never assumes three. When the fourth safety gate is approved and
 * added to the shared constant, this component grows a row with no layout change.
 *
 * ACCESSIBILITY: state is never conveyed by colour alone. The compact dot view carries an
 * `aria-label` and a `title` per gate plus a screen-reader-only summary; the expanded view spells
 * every gate out in text.
 */

import { APPROVAL_GATES } from "@meetezri/shared";
import { cn } from "@/lib/utils";
import type { ContentHubApprovalState } from "@/lib/api";

const GATE_LABEL: Record<string, string> = {
  founder: "Founder",
  marketing: "Marketing",
  seo: "SEO",
  // Present ahead of the decision so the label is right the moment the gate is approved.
  safety: "Safety",
};

const STATE_LABEL: Record<ContentHubApprovalState, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const STATE_DOT: Record<ContentHubApprovalState, string> = {
  pending: "bg-white/25",
  approved: "bg-emerald-400",
  changes_requested: "bg-amber-400",
};

/** Gate label from the map, falling back to a readable form of the raw key. */
function gateLabel(gate: string): string {
  return GATE_LABEL[gate] ?? gate.replace(/_/g, " ");
}

function stateOf(
  approvals: Record<string, ContentHubApprovalState> | undefined,
  gate: string,
): ContentHubApprovalState {
  return approvals?.[gate] ?? "pending";
}

export interface ApprovalDotsProps {
  approvals: Record<string, ContentHubApprovalState> | undefined;
  /** `dots` for dense table cells, `list` for detail panels. */
  variant?: "dots" | "list";
  className?: string;
}

export function ApprovalDots({ approvals, variant = "dots", className }: ApprovalDotsProps) {
  const gates = [...APPROVAL_GATES] as string[];

  if (variant === "list") {
    return (
      <ul className={cn("space-y-1.5", className)}>
        {gates.map((gate) => {
          const state = stateOf(approvals, gate);
          return (
            <li key={gate} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATE_DOT[state])} />
              <span className="text-[var(--admin-text-secondary)]">{gateLabel(gate)}:</span>
              <span className="font-medium text-[var(--admin-text)]">{STATE_LABEL[state]}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  const summary = gates
    .map((gate) => `${gateLabel(gate)}: ${STATE_LABEL[stateOf(approvals, gate)]}`)
    .join(", ");

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {gates.map((gate) => {
        const state = stateOf(approvals, gate);
        const text = `${gateLabel(gate)}: ${STATE_LABEL[state]}`;
        return (
          <span
            key={gate}
            role="img"
            aria-label={text}
            title={text}
            className={cn("h-2.5 w-2.5 rounded-full", STATE_DOT[state])}
          />
        );
      })}
      {/* Screen readers get the whole summary as one readable sentence. */}
      <span className="sr-only">Approvals — {summary}</span>
    </span>
  );
}

export { gateLabel, STATE_LABEL as approvalStateLabel };
