import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const rowStyles = cn(
  "flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-4 py-3.5 text-left text-[var(--solace-ds-text)] transition-colors duration-300",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "hover:border-[color:var(--solace-ds-border-glow)] hover:bg-white/[0.05] hover:shadow-[0_0_32px_-8px_var(--solace-ds-glow-purple),inset_0_1px_0_rgba(255,255,255,0.06)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]"
);

export interface SolaceDataRowDivProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: "div";
}

export interface SolaceDataRowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  as: "button";
}

export type SolaceDataRowProps = SolaceDataRowDivProps | SolaceDataRowButtonProps;

/**
 * Billing/history style row: dark surface, soft divider, hover glow — not a white table cell.
 */
export function SolaceDataRow(props: SolaceDataRowProps) {
  if (props.as === "button") {
    const { as, children, className, type = "button", ...btnProps } = props;
    return (
      <button type={type} className={cn(rowStyles, className)} {...btnProps}>
        {children}
      </button>
    );
  }

  const { as, children, className, ...divProps } = props as SolaceDataRowDivProps;
  return (
    <div className={cn(rowStyles, className)} {...divProps}>
      {children}
    </div>
  );
}
