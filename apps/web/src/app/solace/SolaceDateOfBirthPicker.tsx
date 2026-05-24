import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { format, isValid, parseISO, subYears } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/app/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  birthIsoToAgeYears,
  formatDateOfBirthForInput,
  isIsoDobMeetingMinAge,
  isIsoDobString,
  maxBirthDateForMinAge,
  minAccountAgeMessage,
  parseDateOfBirthInput,
} from "@/lib/profileAge";
import { solaceCalendarClassNames, solaceCalendarPopoverClass } from "./solaceCalendarTheme";

type InputErrorKind = "invalid" | "underage" | null;

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
  /** Minimum age in years (default 13). Profile uses 18. */
  minAgeYears?: number;
  /** When set, under-age messaging is shown here instead of inline (e.g. react-hook-form FormMessage). */
  externalError?: string;
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
  externalError,
  className,
}: SolaceDateOfBirthPickerProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [inputError, setInputError] = useState<InputErrorKind>(null);

  const isoValue = isIsoDobString(value) ? value.trim() : "";
  const selected = useMemo(() => {
    if (!isoValue) return undefined;
    const parsed = parseISO(isoValue);
    return isValid(parsed) ? parsed : undefined;
  }, [isoValue]);

  const maxDate = useMemo(() => maxBirthDateForMinAge(minAgeYears), [minAgeYears]);

  const computedAge = isoValue ? birthIsoToAgeYears(isoValue) : undefined;
  const isUnderMinAge =
    computedAge !== undefined && computedAge < minAgeYears;

  const underAgeMessage =
    minAgeYears === 18
      ? minAccountAgeMessage
      : `You must be at least ${minAgeYears} years old.`;

  const showFieldError =
    Boolean(inputError) || isUnderMinAge || Boolean(externalError);

  const inlineErrorMessage =
    externalError ??
    (inputError === "invalid"
      ? `Enter a valid date (MM/DD/YYYY). You must be at least ${minAgeYears} years old.`
      : inputError === "underage" || isUnderMinAge
        ? underAgeMessage
        : null);

  useEffect(() => {
    if (isFocused) return;
    setTextValue(isoValue ? formatDateOfBirthForInput(isoValue) : "");
    if (isoValue && !isIsoDobMeetingMinAge(isoValue, minAgeYears)) {
      setInputError("underage");
    } else {
      setInputError((prev) => (prev === "underage" ? null : prev));
    }
  }, [isoValue, isFocused, minAgeYears]);

  const commitTextValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInputError(null);
      onChange("");
      setTextValue("");
      return true;
    }

    const parsed = parseDateOfBirthInput(trimmed, 0);
    if (!parsed?.iso) {
      setInputError("invalid");
      return false;
    }

    if (!isIsoDobMeetingMinAge(parsed.iso, minAgeYears)) {
      setInputError("underage");
      onChange(parsed.iso);
      setTextValue(formatDateOfBirthForInput(parsed.iso));
      return false;
    }

    setInputError(null);
    onChange(parsed.iso);
    setTextValue(formatDateOfBirthForInput(parsed.iso));
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
      setInputError(null);
      setTextValue(isoValue ? formatDateOfBirthForInput(isoValue) : "");
      (event.target as HTMLInputElement).blur();
    }
  };

  const calendarDefaultMonth = useMemo(() => {
    if (selected && selected.getTime() <= maxDate.getTime()) return selected;
    return subYears(maxDate, 12);
  }, [selected, maxDate]);

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative w-full">
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
                if (inputError) setInputError(null);
              }}
              onFocus={() => {
                setIsFocused(true);
                if (isoValue && !textValue) {
                  setTextValue(formatDateOfBirthForInput(isoValue));
                }
              }}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              aria-invalid={showFieldError}
              aria-describedby={
                inlineErrorMessage ? `${inputId}-error` : undefined
              }
              className={cn(
                triggerClassName,
                "pr-12",
                showFieldError && "border-rose-400/40 ring-2 ring-rose-500/20"
              )}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen((prev) => !prev)}
              className={cn(
                "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg",
                "text-violet-300/80 transition-colors",
                "hover:bg-violet-500/15 hover:text-violet-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
              )}
              aria-label="Open calendar"
              aria-expanded={open}
            >
              <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
            </button>
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
              const iso = format(date, "yyyy-MM-dd");
              onChange(iso);
              setTextValue(formatDateOfBirthForInput(iso));
              setInputError(null);
              setOpen(false);
            }}
            disabled={{ after: maxDate }}
            defaultMonth={calendarDefaultMonth}
            fromDate={new Date(1900, 0, 1)}
            toDate={maxDate}
            initialFocus
            classNames={solaceCalendarClassNames}
          />
        </PopoverContent>
      </Popover>

      {inlineErrorMessage && !externalError ? (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs text-rose-300/90"
          role="alert"
        >
          {inlineErrorMessage}
        </p>
      ) : null}

      {showAgeHint && computedAge !== undefined && !showFieldError ? (
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
