import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/lib/utils";

export type SolaceSelectVariant = "compact" | "default" | "form" | "pagination";

export interface SolaceSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SolaceSelectOptionGroup {
  label: string;
  options: SolaceSelectOption[];
}

const solaceSelectTriggerLight = cn(
  "[html[data-ezri-theme=light]_&]:border-[color:var(--input-border,#ddd0fa)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--input-text,#101828)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_4px_16px_-8px_rgba(88,28,135,0.08)]",
  "[html[data-ezri-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-ezri-theme=light]_&]:hover:bg-[var(--input-bg,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:focus-visible:border-violet-400/45",
  "[html[data-ezri-theme=light]_&]:focus-visible:ring-violet-400/20",
  "[html[data-ezri-theme=light]_&]:data-[placeholder]:text-[var(--input-placeholder,#98a2b3)]",
  "[html[data-ezri-theme=light]_&]:data-[state=open]:border-violet-400/45",
  "[html[data-ezri-theme=light]_&]:data-[state=open]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:data-[state=open]:shadow-[0_0_22px_rgba(167,139,250,0.16)]",
  "[html[data-ezri-theme=light]_&]:[&>svg:last-child]:text-violet-600",
  "[html[data-theme=light]_&]:border-[color:var(--input-border,#ddd0fa)]",
  "[html[data-theme=light]_&]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-theme=light]_&]:text-[var(--input-text,#101828)]",
  "[html[data-theme=light]_&]:shadow-[0_4px_16px_-8px_rgba(88,28,135,0.08)]",
  "[html[data-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-theme=light]_&]:hover:bg-[var(--input-bg,#ffffff)]",
  "[html[data-theme=light]_&]:focus-visible:border-violet-400/45",
  "[html[data-theme=light]_&]:focus-visible:ring-violet-400/20",
  "[html[data-theme=light]_&]:data-[placeholder]:text-[var(--input-placeholder,#98a2b3)]",
  "[html[data-theme=light]_&]:data-[state=open]:border-violet-400/45",
  "[html[data-theme=light]_&]:data-[state=open]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-theme=light]_&]:data-[state=open]:shadow-[0_0_22px_rgba(167,139,250,0.16)]",
  "[html[data-theme=light]_&]:[&>svg:last-child]:text-violet-600"
);

const solaceSelectItemLight = cn(
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-ezri-theme=light]_&]:data-[highlighted]:bg-violet-100",
  "[html[data-ezri-theme=light]_&]:data-[highlighted]:text-violet-900",
  "[html[data-ezri-theme=light]_&]:data-[state=checked]:bg-violet-200/70",
  "[html[data-ezri-theme=light]_&]:data-[state=checked]:text-violet-900",
  "[html[data-ezri-theme=light]_&]:[&_svg]:text-violet-600",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:data-[highlighted]:bg-violet-100",
  "[html[data-theme=light]_&]:data-[highlighted]:text-violet-900",
  "[html[data-theme=light]_&]:data-[state=checked]:bg-violet-200/70",
  "[html[data-theme=light]_&]:data-[state=checked]:text-violet-900",
  "[html[data-theme=light]_&]:[&_svg]:text-violet-600"
);

/** Compact filter pill (timeline ranges, brain health rails). */
export const solaceSelectTriggerCompact = cn(
  "h-8 w-fit min-w-[5.5rem] shrink-0 gap-1 rounded-full border border-white/[0.1] bg-black/50 py-1 pl-3 pr-1.5 text-[11px] font-medium tracking-wide text-zinc-200 shadow-none outline-none transition-[border-color,box-shadow,background-color]",
  "hover:border-violet-400/35 hover:bg-black/65",
  "focus-visible:border-violet-400/45 focus-visible:ring-2 focus-visible:ring-violet-400/30",
  "data-[state=open]:border-violet-400/45 data-[state=open]:bg-black/60 data-[state=open]:shadow-[0_0_22px_rgba(139,92,246,0.18)]",
  "dark:border-white/10 dark:bg-black/50 dark:hover:bg-black/60",
  "[&>svg:last-child]:size-3 [&>svg:last-child]:text-violet-300/85",
  solaceSelectTriggerLight,
  "[html[data-ezri-theme=light]_&]:rounded-full [html[data-theme=light]_&]:rounded-full"
);

/** Standard inline filter / toolbar control. */
export const solaceSelectTriggerDefault = cn(
  "h-10 min-h-10 w-full gap-2 rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-sm font-medium text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "hover:border-violet-400/28 hover:bg-black/50",
  "focus-visible:border-violet-400/35 focus-visible:ring-2 focus-visible:ring-violet-400/25 focus-visible:outline-none",
  "data-[placeholder]:text-zinc-500",
  "data-[state=open]:border-violet-400/40 data-[state=open]:bg-black/55 data-[state=open]:shadow-[0_0_24px_rgba(139,92,246,0.14)]",
  "[&>svg:last-child]:size-4 [&>svg:last-child]:shrink-0 [&>svg:last-child]:text-violet-300/80",
  solaceSelectTriggerLight
);

/** Form fields and modals (full width). */
export const solaceSelectTriggerForm = cn(
  "h-12 min-h-[48px] w-full gap-2 rounded-xl border border-white/[0.088] bg-black/40 px-4 py-3 text-[15px] font-normal text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
  "hover:border-violet-400/28 hover:bg-black/50",
  "focus-visible:border-violet-400/35 focus-visible:ring-2 focus-visible:ring-violet-400/25 focus-visible:outline-none",
  "data-[placeholder]:text-zinc-500",
  "data-[state=open]:border-violet-400/40 data-[state=open]:bg-black/55 data-[state=open]:shadow-[0_0_24px_rgba(139,92,246,0.14)]",
  "[&>svg:last-child]:size-4 [&>svg:last-child]:shrink-0 [&>svg:last-child]:text-violet-300/80",
  solaceSelectTriggerLight
);

/** Pagination page-size control. */
export const solaceSelectTriggerPagination = cn(
  "h-9 min-h-9 w-[4.5rem] gap-1 rounded-lg border border-white/[0.088] bg-black/40 px-2.5 py-1.5 text-[12px] font-medium tabular-nums normal-case text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
  "hover:border-violet-400/28 hover:bg-black/50",
  "focus-visible:border-violet-400/35 focus-visible:ring-2 focus-visible:ring-violet-400/25 focus-visible:outline-none",
  "data-[state=open]:border-violet-400/40 data-[state=open]:bg-black/55 data-[state=open]:shadow-[0_0_20px_rgba(139,92,246,0.14)]",
  "[&>svg:last-child]:size-3.5 [&>svg:last-child]:shrink-0 [&>svg:last-child]:text-violet-300/80",
  solaceSelectTriggerLight
);

export const solaceSelectContentClass = cn(
  "solace-select-content z-[200] max-h-[min(280px,var(--radix-select-content-available-height))] overflow-hidden rounded-xl border border-white/[0.1]",
  "bg-[#090b12]/[0.98] p-1.5 text-zinc-200 shadow-[0_28px_60px_-12px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.12)] backdrop-blur-xl",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_20px_50px_-12px_rgba(88,28,135,0.14),0_0_28px_rgba(167,139,250,0.12)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:shadow-[0_20px_50px_-12px_rgba(88,28,135,0.14),0_0_28px_rgba(167,139,250,0.12)]"
);

export const solaceSelectLabelClass = cn(
  "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const solaceSelectItemClass = cn(
  "relative cursor-pointer rounded-lg py-2.5 pl-3 pr-9 text-[14px] text-zinc-200 outline-none select-none",
  "data-[highlighted]:bg-violet-500/18 data-[highlighted]:text-zinc-50",
  "data-[state=checked]:bg-violet-500/22 data-[state=checked]:text-zinc-50",
  "[&_svg]:text-violet-300/90",
  solaceSelectItemLight
);

export const solaceSelectItemCompactClass = cn(
  "relative cursor-pointer rounded-lg py-2 pl-3 pr-8 text-[11px] text-zinc-200 outline-none select-none",
  "data-[highlighted]:bg-violet-500/18 data-[highlighted]:text-zinc-50",
  "data-[state=checked]:bg-violet-500/22 data-[state=checked]:text-zinc-50",
  "[&_svg]:text-violet-300/90",
  solaceSelectItemLight
);

function triggerClassForVariant(variant: SolaceSelectVariant, extra?: string) {
  const base =
    variant === "compact"
      ? solaceSelectTriggerCompact
      : variant === "form"
        ? solaceSelectTriggerForm
        : variant === "pagination"
          ? solaceSelectTriggerPagination
          : solaceSelectTriggerDefault;
  return cn(base, extra);
}

function itemClassForVariant(variant: SolaceSelectVariant, extra?: string) {
  return cn(variant === "compact" ? solaceSelectItemCompactClass : solaceSelectItemClass, extra);
}

export interface SolaceSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: SolaceSelectOption[];
  groups?: SolaceSelectOptionGroup[];
  ariaLabel: string;
  placeholder?: string;
  variant?: SolaceSelectVariant;
  size?: "sm" | "default";
  id?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export function SolaceSelect({
  value,
  onValueChange,
  options = [],
  groups,
  ariaLabel,
  placeholder,
  variant = "default",
  size = "default",
  id,
  disabled,
  triggerClassName,
  contentClassName,
  itemClassName,
}: SolaceSelectProps) {
  const flatOptions = [...(groups?.flatMap((g) => g.options) ?? []), ...options];
  const hasValue = value.length > 0 && flatOptions.some((o) => o.value === value);

  const renderItems = (items: SolaceSelectOption[]) =>
    items.map((option) => (
      <SelectItem
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        className={itemClassForVariant(variant, itemClassName)}
      >
        {option.label}
      </SelectItem>
    ));

  return (
    <Select value={hasValue ? value : undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={triggerClassForVariant(variant, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        sideOffset={6}
        avoidCollisions
        className={cn(solaceSelectContentClass, contentClassName)}
      >
        {groups?.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className={solaceSelectLabelClass}>{group.label}</SelectLabel>
            {renderItems(group.options)}
          </SelectGroup>
        ))}
        {groups && options.length > 0 ? renderItems(options) : !groups ? renderItems(options) : null}
      </SelectContent>
    </Select>
  );
}
