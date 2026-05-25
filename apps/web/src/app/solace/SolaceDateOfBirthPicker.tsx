import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { format, isValid, parseISO, subYears } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
import { SolaceCalendarInput } from "./SolaceCalendarInput";

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
  const [isFocused, setIsFocused] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [inputError, setInputError] = useState<InputErrorKind>(null);

  const isoValue = isIsoDobString(value) ? value.trim() : "";

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
    if (!isoValue) return subYears(maxDate, 12);
    const parsed = parseISO(isoValue);
    if (isValid(parsed) && parsed.getTime() <= maxDate.getTime()) return parsed;
    return subYears(maxDate, 12);
  }, [isoValue, maxDate]);

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            labelClassName,
            showLabelIcon && "flex items-center gap-2",
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

      <SolaceCalendarInput
        id={inputId}
        value={isoValue}
        onChange={(iso) => {
          onChange(iso);
          setTextValue(iso ? formatDateOfBirthForInput(iso) : "");
          setInputError(null);
        }}
        disabled={disabled}
        triggerClassName={triggerClassName}
        placeholder={placeholder}
        showFieldError={showFieldError}
        textValue={textValue}
        onTextValueChange={(next) => {
          setTextValue(next);
          if (inputError) setInputError(null);
        }}
        onTextFocus={() => {
          setIsFocused(true);
          if (isoValue && !textValue) {
            setTextValue(formatDateOfBirthForInput(isoValue));
          }
        }}
        onTextBlur={handleInputBlur}
        onTextKeyDown={handleInputKeyDown}
        inputMode="numeric"
        autoComplete="bday"
        ariaInvalid={showFieldError}
        ariaDescribedBy={inlineErrorMessage ? `${inputId}-error` : undefined}
        fromDate={new Date(1900, 0, 1)}
        toDate={maxDate}
        defaultMonth={calendarDefaultMonth}
        calendarDisabled={{ after: maxDate }}
        footer={
          <>
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
          </>
        }
      />
    </div>
  );
}
