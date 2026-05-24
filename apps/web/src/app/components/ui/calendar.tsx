"use client";

import * as React from "react";
import { addYears, format, subYears } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DayPicker,
  type CaptionProps,
  useDayPicker,
  useNavigation,
} from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

const defaultClassNames = {
  months: "flex flex-col sm:flex-row gap-2",
  month: "flex flex-col gap-4",
  caption: "flex justify-center pt-1 relative items-center w-full",
  caption_label: "text-sm font-medium",
  nav: "hidden",
  nav_button: cn(
    buttonVariants({ variant: "outline" }),
    "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  ),
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse space-x-1",
  head_row: "flex",
  head_cell:
    "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
  row: "flex w-full mt-2",
  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected])]:rounded-md",
  day: cn(
    buttonVariants({ variant: "ghost" }),
    "size-8 p-0 font-normal aria-selected:opacity-100",
  ),
  day_range_start:
    "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
  day_range_end:
    "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
  day_selected:
    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  day_today: "bg-accent text-accent-foreground",
  day_outside:
    "day-outside text-muted-foreground aria-selected:text-muted-foreground",
  day_disabled: "text-muted-foreground opacity-50",
  day_range_middle:
    "aria-selected:bg-accent aria-selected:text-accent-foreground",
  day_hidden: "invisible",
};

function CalendarNavCaption({ displayMonth }: CaptionProps) {
  const { classNames } = useDayPicker();
  const { goToMonth, previousMonth, nextMonth } = useNavigation();
  const navButtonClass = cn(classNames?.nav_button);

  return (
    <div className={cn(classNames?.caption, "relative flex w-full items-center justify-center pt-1")}>
      <div className="absolute left-1 flex items-center gap-0.5">
        <button
          type="button"
          className={navButtonClass}
          aria-label="Previous year"
          onClick={() => goToMonth(subYears(displayMonth, 1))}
        >
          <ChevronsLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={navButtonClass}
          aria-label="Previous month"
          disabled={!previousMonth}
          onClick={() => previousMonth && goToMonth(previousMonth)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </div>
      <div className={classNames?.caption_label}>
        {format(displayMonth, "MMMM yyyy")}
      </div>
      <div className="absolute right-1 flex items-center gap-0.5">
        <button
          type="button"
          className={navButtonClass}
          aria-label="Next month"
          disabled={!nextMonth}
          onClick={() => nextMonth && goToMonth(nextMonth)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={navButtonClass}
          aria-label="Next year"
          onClick={() => goToMonth(addYears(displayMonth, 1))}
        >
          <ChevronsRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const rangeCellClass =
    props.mode === "range"
      ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
      : "[&:has([aria-selected])]:rounded-md";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        ...defaultClassNames,
        cell: cn(defaultClassNames.cell, rangeCellClass),
        ...classNames,
        nav: classNames?.nav ?? defaultClassNames.nav,
      }}
      components={{
        Caption: CalendarNavCaption,
        ...components,
      }}
      {...props}
    />
  );
}

export { Calendar, CalendarNavCaption };
