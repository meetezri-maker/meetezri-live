import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { format, isValid, parseISO, subYears } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/app/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  birthIsoToAgeYears,
  formatDateOfBirthForInput,
  isIsoDobString,
  parseDateOfBirthInput,
} from "@/lib/profileAge";
import { solaceCalendarClassNames, solaceCalendarPopoverClass } from "./solaceCalendarTheme";

export interface SolaceDateOfBirthPickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  label?: string;
  labelClassName?: string;
  showLabelIcon?: boolean;
  showAgeHint?: boolean;
  placeholder?: string;
  id?: string;
  /** Minimum age in years (default 13). */
  minAgeYears?: number;
  className?: string;
}

export function SolaceDateOfBirthPicker({
  value,
  onChange,
  disabled = false,
  triggerClassName,
  label,
  labelClassName,
  showLabelIcon = true,
  showAgeHint = true,
  placeholder = "MM/DD/YYYY",
  id: idProp,
  minAgeYears = 13,
  className,
}: SolaceDateOfBirthPickerProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [parseError, setParseError] = useState(false);

  const isoValue = isIsoDobString(value) ? value.trim() : "";
  const selected = useMemo(() => {
    if (!isoValue) return undefined;
    const parsed = parseISO(isoValue);
    return isValid(parsed) ? parsed : undefined;
  }, [isoValue]);

  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - minAgeYears);
    return date;
  }, [minAgeYears]);

  const computedAge = isoValue ? birthIsoToAgeYears(isoValue) : undefined;

  useEffect(() => {
    if (isFocused) return;
    setTextValue(isoValue ? formatDateOfBirthForInput(isoValue) : "");
    setParseError(false);
  }, [isoValue, isFocused]);

  const commitTextValue = (raw: string) => {
    const result = parseDateOfBirthInput(raw, minAgeYears);
    if (result === null) {
      setParseError(Boolean(raw.trim()));
      return false;
    }
    setParseError(false);
    onChange(result.iso);
    if (result.iso) {
      setTextValue(formatDateOfBirthForInput(result.iso));
    } else {
      setTextValue("");
    }
    return true;
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    commitTextValue(textValue);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitTextValue(textValue)) {
        (event.target as HTMLInputElement).blur();
      }
    }
    if (event.key === "Escape") {
      setParseError(false);
      setTextValue(isoValue ? formatDateOfBirthForInput(isoValue) : "");
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            labelClassName,
            showLabelIcon && "flex items-center gap-2"
          )}
        >
          {showLabelIcon ? (
            <CalendarIcon
              className="h-4 w-4 shrink-0 text-violet-300/85"
              aria-hidden
            />
          ) : null}
          <span>{label}</span>
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          disabled={disabled}
          placeholder={placeholder}
          value={textValue}
          onChange={(e) => {
            setTextValue(e.target.value);
            if (parseError) setParseError(false);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (isoValue && !textValue) {
              setTextValue(formatDateOfBirthForInput(isoValue));
            }
          }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          aria-invalid={parseError}
          aria-describedby={parseError ? `${inputId}-error` : undefined}
          className={cn(
            triggerClassName,
            "pr-12",
            parseError && "border-rose-400/40 ring-2 ring-rose-500/20"
          )}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg",
                "text-violet-300/80 transition-colors",
                "hover:bg-violet-500/15 hover:text-violet-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
              )}
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className={solaceCalendarPopoverClass}
            align="end"
          >
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (!date) return;
                const iso = format(date, "yyyy-MM-dd");
                onChange(iso);
                setTextValue(formatDateOfBirthForInput(iso));
                setParseError(false);
                setOpen(false);
              }}
              disabled={{ after: maxDate }}
              defaultMonth={selected ?? subYears(maxDate, 12)}
              initialFocus
              classNames={solaceCalendarClassNames}
            />
          </PopoverContent>
        </Popover>
      </div>

      {parseError ? (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs text-rose-300/90"
          role="alert"
        >
          Enter a valid date (MM/DD/YYYY). You must be at least {minAgeYears} years old.
        </p>
      ) : null}

      {showAgeHint && computedAge !== undefined && !parseError ? (
        <p className="mt-2 text-xs text-violet-200/65">
          <span className="text-[rgba(255,255,255,0.45)]">Age: </span>
          <span className="font-semibold text-violet-100/95">
            {computedAge} years old
          </span>
        </p>
      ) : null}
    </div>
  );
}
