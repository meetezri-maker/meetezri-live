"use client";

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { solaceCalendarClassNames, solaceCalendarPopoverClass } from "./solaceCalendarTheme";

export interface SolaceCalendarInputProps {
  /** ISO date string (yyyy-MM-dd) or empty */
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  showFieldError?: boolean;
  /** Text field value and handlers (birthday parsing, plain ISO, etc.) */
  textValue: string;
  onTextValueChange: (value: string) => void;
  onTextFocus?: () => void;
  onTextBlur?: () => void;
  onTextKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  fromDate?: Date;
  toDate?: Date;
  defaultMonth?: Date;
  calendarDisabled?: { after?: Date; before?: Date };
  footer?: ReactNode;
}

/** Shared Solace date field shell: text input + calendar icon popover with toggle-on-second-click. */
export function SolaceCalendarInput({
  value,
  onChange,
  disabled = false,
  triggerClassName,
  placeholder = "Select date",
  id: idProp,
  className,
  showFieldError = false,
  textValue,
  onTextValueChange,
  onTextFocus,
  onTextBlur,
  onTextKeyDown,
  inputMode = "text",
  autoComplete,
  ariaInvalid,
  ariaDescribedBy,
  fromDate,
  toDate,
  defaultMonth,
  calendarDisabled,
  footer,
}: SolaceCalendarInputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = parseISO(trimmed);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const resolvedDefaultMonth = defaultMonth ?? selected ?? new Date();

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative w-full">
            <input
              id={inputId}
              type="text"
              inputMode={inputMode}
              autoComplete={autoComplete}
              disabled={disabled}
              placeholder={placeholder}
              value={textValue}
              onChange={(e) => onTextValueChange(e.target.value)}
              onFocus={onTextFocus}
              onBlur={onTextBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                }
                onTextKeyDown?.(e);
              }}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={cn(
                triggerClassName,
                "pr-12",
                showFieldError && "border-rose-400/40 ring-2 ring-rose-500/20",
              )}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg",
                  "text-violet-300/80 transition-colors",
                  "hover:bg-violet-500/15 hover:text-violet-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35",
                )}
                aria-label={open ? "Close calendar" : "Open calendar"}
                aria-expanded={open}
              >
                <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className={solaceCalendarPopoverClass}
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions={false}
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
            disabled={calendarDisabled}
            defaultMonth={resolvedDefaultMonth}
            fromDate={fromDate}
            toDate={toDate}
            initialFocus
            classNames={solaceCalendarClassNames}
          />
        </PopoverContent>
      </Popover>
      {footer}
    </div>
  );
}
