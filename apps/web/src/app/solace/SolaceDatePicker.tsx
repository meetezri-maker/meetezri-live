"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { SolaceCalendarInput } from "./SolaceCalendarInput";

export interface SolaceDatePickerProps {
  /** ISO date string (yyyy-MM-dd) or empty */
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** General-purpose Solace date field (ISO value). Calendar icon toggles open/close. */
export function SolaceDatePicker({
  value,
  onChange,
  disabled = false,
  triggerClassName,
  placeholder = "Select date",
  id,
  className,
  fromDate,
  toDate,
}: SolaceDatePickerProps) {
  const [textValue, setTextValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const isoValue = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = parseISO(trimmed);
    return isValid(parsed) ? trimmed : "";
  }, [value]);

  useEffect(() => {
    if (isFocused) return;
    if (!isoValue) {
      setTextValue("");
      return;
    }
    setTextValue(format(parseISO(isoValue), "MMM d, yyyy"));
  }, [isoValue, isFocused]);

  const calendarDisabled = useMemo(() => {
    const matcher: { after?: Date; before?: Date } = {};
    if (toDate) matcher.after = toDate;
    if (fromDate) matcher.before = fromDate;
    return Object.keys(matcher).length > 0 ? matcher : undefined;
  }, [fromDate, toDate]);

  return (
    <SolaceCalendarInput
      id={id}
      className={className}
      value={isoValue}
      onChange={onChange}
      disabled={disabled}
      triggerClassName={triggerClassName}
      placeholder={placeholder}
      textValue={textValue}
      onTextValueChange={setTextValue}
      onTextFocus={() => setIsFocused(true)}
      onTextBlur={() => {
        setIsFocused(false);
        if (!isoValue) {
          setTextValue("");
          return;
        }
        setTextValue(format(parseISO(isoValue), "MMM d, yyyy"));
      }}
      fromDate={fromDate}
      toDate={toDate}
      calendarDisabled={calendarDisabled}
      defaultMonth={isoValue ? parseISO(isoValue) : toDate}
    />
  );
}
