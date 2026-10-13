"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { fromIsoDay, toIsoDay, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Monday of the week the date falls in.
function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function span(from: Date, to: Date): DateRange {
  return { from: toIsoDay(from), to: toIsoDay(to) };
}

// "Last" means the previous whole calendar week, month or quarter.
const presets: { label: string; range: (today: Date) => DateRange }[] = [
  { label: "Today", range: (today) => span(today, today) },
  {
    label: "Yesterday",
    range: (today) => span(addDays(today, -1), addDays(today, -1)),
  },
  {
    label: "Last week",
    range: (today) => {
      const monday = addDays(startOfWeek(today), -7);
      return span(monday, addDays(monday, 6));
    },
  },
  {
    label: "Last month",
    range: (today) =>
      span(
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
        new Date(today.getFullYear(), today.getMonth(), 0),
      ),
  },
  {
    label: "Last quarter",
    range: (today) => {
      const quarterStart = Math.floor(today.getMonth() / 3) * 3;
      return span(
        new Date(today.getFullYear(), quarterStart - 3, 1),
        new Date(today.getFullYear(), quarterStart, 0),
      );
    },
  },
];

function formatDay(day: string) {
  return fromIsoDay(day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

// A filter button that opens a calendar for picking a span of days, with
// shortcuts for common spans. `label` names the date being filtered and is
// shown until a range is picked. In a form, `showPresets={false}` leaves
// just the calendar, without the shortcuts and Reset.
export function DateRangeFilter({
  id,
  label,
  value,
  onChange,
  showPresets = true,
  applyFirstClick = false,
  className,
}: {
  id?: string;
  label: string;
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  showPresets?: boolean;
  // Apply the first day clicked right away, as a one-day span, instead of
  // waiting for the second click.
  applyFirstClick?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // First day of the month on show.
  const [month, setMonth] = useState(() => new Date());
  // The first day clicked, while waiting for the second.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setAnchor(null);
    setHovered(null);
    const shown = value ? fromIsoDay(value.to) : new Date();
    setMonth(new Date(shown.getFullYear(), shown.getMonth(), 1));
  }

  function pickDay(day: string) {
    if (!anchor) {
      setAnchor(day);
      if (applyFirstClick) onChange({ from: day, to: day });
      return;
    }
    onChange(
      day < anchor ? { from: day, to: anchor } : { from: anchor, to: day },
    );
    setAnchor(null);
    setHovered(null);
  }

  // What to paint: the span being dragged out, else the applied one.
  const other = hovered ?? anchor;
  const shown: DateRange | null =
    anchor && other
      ? other < anchor
        ? { from: other, to: anchor }
        : { from: anchor, to: other }
      : value;

  const today = toIsoDay(new Date());
  const gridStart = startOfWeek(
    new Date(month.getFullYear(), month.getMonth(), 1),
  );
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        id={id}
        render={
          <Button
            variant="outline"
            type="button"
            className={cn(
              "rounded-full",
              value && "border-foreground/40",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="text-muted-foreground" />
        {value
          ? value.from === value.to
            ? formatDay(value.from)
            : `${formatDay(value.from)} – ${formatDay(value.to)}`
          : label}
        <ChevronDownIcon className="text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="isolate z-50 outline-none"
          side="bottom"
          align="start"
          sideOffset={6}
        >
          <Popover.Popup
            data-slot="date-range-content"
            className="flex max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col gap-4 rounded-2xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:flex-row sm:gap-6"
          >
            {showPresets && (
              <div className="flex flex-row flex-wrap gap-1 sm:w-32 sm:flex-col">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onChange(preset.range(new Date()));
                      setOpen(false);
                    }}
                    className="rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!value && !anchor}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="rounded-lg px-2 py-1.5 text-left text-sm font-medium text-blue-500 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 sm:mt-auto"
                >
                  Reset
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <span className="flex-1 px-1 text-sm font-semibold">
                  {month.toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRightIcon />
                </Button>
              </div>

              <div
                className="grid grid-cols-7 gap-y-0.5 text-center text-sm"
                onMouseLeave={() => setHovered(null)}
              >
                {weekdays.map((weekday) => (
                  <span
                    key={weekday}
                    className="flex size-9 items-center justify-center text-xs text-muted-foreground"
                  >
                    {weekday}
                  </span>
                ))}
                {days.map((date) => {
                  const day = toIsoDay(date);
                  const isStart = shown?.from === day;
                  const isEnd = shown?.to === day;
                  const inRange =
                    shown != null && day >= shown.from && day <= shown.to;
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={date.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      aria-pressed={inRange}
                      onClick={() => pickDay(day)}
                      onMouseEnter={() => anchor && setHovered(day)}
                      className={cn(
                        "flex size-9 items-center justify-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        inRange
                          ? "bg-blue-500/15"
                          : "rounded-full hover:bg-accent",
                        isStart && "rounded-l-full",
                        isEnd && "rounded-r-full",
                        date.getMonth() !== month.getMonth() &&
                          "text-muted-foreground/60",
                        day === today && "font-semibold text-blue-500",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full",
                          (isStart || isEnd) &&
                            "bg-blue-500 font-medium text-white",
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
