"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  CalendarDaysIcon,
  FlagIcon,
  MapPinIcon,
  TagIcon,
  UserCogIcon,
  XIcon,
} from "lucide-react";

import { DateRangeFilter } from "@/components/date-range-filter";
import {
  AnimatedNumber,
  BentoCard,
  StatCard,
  TooltipBox,
  TooltipRow,
  growClass,
  useGrowIn,
} from "@/components/laptop-analytics-dashboard";
import { FilterMenu } from "@/components/laptop-inventory-table";
import { Scrollable } from "@/components/scrollable";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { requestPriorities, type RequestPriority } from "@/lib/asset-requests";
import { inDateRange, type DateRange } from "@/lib/date-range";
import { formatDate } from "@/lib/laptops";
import {
  formatMinutes,
  isOpenTicket,
  personName,
  resolutionMinutes,
  ticketCategories,
  ticketCategoryGroup,
  ticketStatusStyles,
  ticketStatuses,
  type Ticket,
} from "@/lib/tickets";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const UNASSIGNED = "Unassigned";
const UNKNOWN_LOCATION = "Not recorded";

const monthChartConfig = {
  opened: {
    label: "Opened",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

// Single-hue bars for the ranked lists, matching the chart above.
const barFill = "bg-[#2a78d6] dark:bg-[#6da7ec]";

type Row = Ticket & {
  group: string;
  assignee: string;
  location: string;
  minutes: number | null;
  year: string;
};

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : 0;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percent(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "0%";
}

// Total time in whole hours, for the headline tile.
function formatHours(minutes: number) {
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString()} ${hours === 1 ? "hr" : "hrs"}`;
}

function resolvedMinutes(rows: Row[]) {
  return rows.flatMap((r) => (r.minutes === null ? [] : [r.minutes]));
}

// "2026-10" for a timestamp or a Date, in local time.
function monthKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

type MonthRow = {
  key: string;
  label: string;
  opened: number;
  closed: number;
  avgMinutes: number | null;
};

function MonthlyCard({ rows }: { rows: Row[] }) {
  const data = useMemo((): MonthRow[] => {
    if (rows.length === 0) return [];
    const keys = rows.map((r) => monthKey(r.createdAt)).sort();
    const [firstYear, firstMonth] = keys[0].split("-").map(Number);
    const [lastYear, lastMonth] = keys.at(-1)!.split("-").map(Number);
    const months: MonthRow[] = [];
    // Every month in between, including empty ones.
    for (
      let d = new Date(firstYear, firstMonth - 1, 1);
      d <= new Date(lastYear, lastMonth - 1, 1);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ) {
      const key = monthKey(d);
      const opened = rows.filter((r) => monthKey(r.createdAt) === key);
      const times = resolvedMinutes(opened);
      months.push({
        key,
        label: monthLabel(key),
        opened: opened.length,
        closed: rows.filter((r) => r.closedAt && monthKey(r.closedAt) === key)
          .length,
        avgMinutes: times.length ? average(times) : null,
      });
    }
    return months;
  }, [rows]);

  return (
    <BentoCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">Tickets per month</CardTitle>
        <CardDescription>
          Tickets opened each month · hover a bar for closures and resolve time
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        {data.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            No tickets match these filters.
          </p>
        ) : (
          <ChartContainer
            config={monthChartConfig}
            className="aspect-auto h-72 w-full"
          >
            <BarChart data={data} margin={{ left: -16, right: 8, top: 12 }}>
              <CartesianGrid
                className="stroke-border"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={12}
                fontSize={11}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />
              <ChartTooltip
                cursor={{ className: "fill-muted" }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as MonthRow | undefined;
                  if (!active || !row) return null;
                  return (
                    <TooltipBox>
                      <div className="font-medium">{row.label}</div>
                      <TooltipRow
                        color="var(--color-opened)"
                        label="Opened"
                        value={row.opened}
                      />
                      <TooltipRow label="Closed" value={row.closed} />
                      <TooltipRow
                        label="Avg resolve time"
                        value={
                          row.avgMinutes === null
                            ? "–"
                            : formatMinutes(row.avgMinutes)
                        }
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Bar
                dataKey="opened"
                fill="var(--color-opened)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={900}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </BentoCard>
  );
}

// Category groups ranked by ticket count. Clicking one filters the page.
function MostRequestedCard({
  rows,
  active,
  onToggle,
}: {
  rows: Row[];
  active: string[];
  onToggle: (group: string) => void;
}) {
  const ready = useGrowIn();
  const groups = ticketCategories
    .map((group) => ({
      group,
      count: rows.filter((r) => r.group === group).length,
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...groups.map((g) => g.count));

  return (
    <BentoCard>
      <CardHeader>
        <CardTitle className="text-base">Most requested troubleshooting</CardTitle>
        <CardDescription>Click a category to filter everything</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0.5">
        {groups.map(({ group, count }) => {
          const selected = active.includes(group);
          return (
            <button
              key={group}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(group)}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected && "bg-muted",
                active.length > 0 && !selected && "opacity-50",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{group}</span>
                <span className="tabular-nums">
                  <span className="font-semibold">
                    <AnimatedNumber value={count} delay={200} />
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {percent(count, rows.length)}
                  </span>
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full", growClass, barFill)}
                  style={{ width: ready ? `${(count / max) * 100}%` : 0 }}
                />
              </span>
            </button>
          );
        })}
      </CardContent>
    </BentoCard>
  );
}

const th =
  "sticky top-0 z-10 h-9 bg-muted px-4 shadow-[inset_0_1px_0_var(--color-border),inset_0_-1px_0_var(--color-border)] text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground";
const td = "border-b border-border px-4 py-2 whitespace-nowrap";

// The individual issue types people report most, as typed on the ticket.
function TopIssuesCard({ rows }: { rows: Row[] }) {
  const ready = useGrowIn();
  const issues = useMemo(() => {
    const byType = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.category.trim();
      byType.set(key, [...(byType.get(key) ?? []), r]);
    }
    return [...byType]
      .map(([issue, list]) => {
        const times = resolvedMinutes(list);
        return {
          issue,
          group: list[0].group,
          count: list.length,
          avg: times.length ? average(times) : null,
          median: times.length ? median(times) : null,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [rows]);
  const max = Math.max(1, ...issues.map((i) => i.count));

  return (
    <BentoCard className="gap-0 pb-0 lg:col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Top issues</CardTitle>
        <CardDescription>
          The 15 most common issue types and how long they take to fix
        </CardDescription>
      </CardHeader>
      <Scrollable className="max-h-96">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={th}>Issue</th>
              <th className={th}>Tickets</th>
              <th className={cn(th, "text-right")}>Avg resolve</th>
              <th className={cn(th, "text-right")}>Median</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.issue} className="hover:bg-muted/40">
                <td className={cn(td, "max-w-56 whitespace-normal")}>
                  <div className="font-medium">{i.issue}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {i.group}
                  </div>
                </td>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          growClass,
                          barFill,
                        )}
                        style={{ width: ready ? `${(i.count / max) * 100}%` : 0 }}
                      />
                    </span>
                    <span className="tabular-nums">{i.count}</span>
                  </span>
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {i.avg === null ? "–" : formatMinutes(i.avg)}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {i.median === null ? "–" : formatMinutes(i.median)}
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Scrollable>
    </BentoCard>
  );
}

function TechnicianCard({ rows }: { rows: Row[] }) {
  const people = [...new Set(rows.map((r) => r.assignee))]
    .map((name) => {
      const theirs = rows.filter((r) => r.assignee === name);
      const times = resolvedMinutes(theirs);
      return {
        name,
        count: theirs.length,
        open: theirs.filter(isOpenTicket).length,
        total: times.reduce((sum, m) => sum + m, 0),
        avg: times.length ? average(times) : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <BentoCard className="gap-0 pb-0 lg:col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Workload by technician</CardTitle>
        <CardDescription>
          Tickets handled, still open, and time spent resolving
        </CardDescription>
      </CardHeader>
      <Scrollable className="max-h-96">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={th}>Assigned to</th>
              <th className={cn(th, "text-right")}>Tickets</th>
              <th className={cn(th, "text-right")}>Open</th>
              <th className={cn(th, "text-right")}>Total resolve time</th>
              <th className={cn(th, "text-right")}>Avg</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.name} className="hover:bg-muted/40">
                <td
                  className={cn(
                    td,
                    "font-medium",
                    p.name === UNASSIGNED && "font-normal text-muted-foreground",
                  )}
                >
                  {p.name}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {p.count}{" "}
                  <span className="text-muted-foreground">
                    {percent(p.count, rows.length)}
                  </span>
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {p.open || <span className="text-muted-foreground">0</span>}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {formatHours(p.total)}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {p.avg === null ? "–" : formatMinutes(p.avg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scrollable>
    </BentoCard>
  );
}

export function TicketAnalyticsDashboard({ tickets }: { tickets: Ticket[] }) {
  const today = useToday();
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);

  const all = useMemo(
    (): Row[] =>
      tickets.map((t) => ({
        ...t,
        group: ticketCategoryGroup(t.category),
        assignee: t.assignedTo ? personName(t.assignedTo) : UNASSIGNED,
        location: t.workLocation ?? UNKNOWN_LOCATION,
        minutes: resolutionMinutes(t),
        year: String(new Date(t.createdAt).getFullYear()),
      })),
    [tickets],
  );

  const assignees = useMemo(
    () => [...new Set(all.map((r) => r.assignee))].sort(),
    [all],
  );
  const locations = useMemo(
    () => [...new Set(all.map((r) => r.location))].sort(),
    [all],
  );
  // Years with tickets, newest first.
  const years = useMemo(
    () => [...new Set(all.map((r) => r.year))].sort().reverse(),
    [all],
  );

  // Filtered by everything except category, so the category ranking still
  // shows the categories that are filtered out.
  const dimRows = useMemo(
    () =>
      all.filter(
        (r) =>
          inDateRange(r.createdAt, dateRange) &&
          (yearFilter.length === 0 || yearFilter.includes(r.year)) &&
          (assigneeFilter.length === 0 || assigneeFilter.includes(r.assignee)) &&
          (priorityFilter.length === 0 || priorityFilter.includes(r.priority)) &&
          (locationFilter.length === 0 || locationFilter.includes(r.location)),
      ),
    [all, dateRange, yearFilter, assigneeFilter, priorityFilter, locationFilter],
  );

  const rows = useMemo(
    () =>
      categoryFilter.length === 0
        ? dimRows
        : dimRows.filter((r) => categoryFilter.includes(r.group)),
    [dimRows, categoryFilter],
  );

  const hasFilters =
    dateRange !== null ||
    yearFilter.length > 0 ||
    categoryFilter.length > 0 ||
    assigneeFilter.length > 0 ||
    priorityFilter.length > 0 ||
    locationFilter.length > 0;

  function clearFilters() {
    setDateRange(null);
    setYearFilter([]);
    setCategoryFilter([]);
    setAssigneeFilter([]);
    setPriorityFilter([]);
    setLocationFilter([]);
  }

  function toggleCategory(group: string) {
    setCategoryFilter((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  }

  const open = rows.filter(isOpenTicket).length;
  const closed = rows.filter((r) => r.status === "Closed").length;
  const times = resolvedMinutes(rows);
  const totalMinutes = times.reduce((sum, m) => sum + m, 0);
  const withinHour = times.filter((m) => m <= 60).length;
  const topGroup = ticketCategories
    .map((g) => ({ g, n: rows.filter((r) => r.group === g).length }))
    .sort((a, b) => b.n - a.n)[0];
  const ready = useGrowIn();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Ticket Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            IT troubleshooting tickets
            {today && <> · as of {formatDate(today)}</>} · {rows.length} of{" "}
            {all.length} tickets
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Year"
            icon={CalendarDaysIcon}
            options={years}
            selected={yearFilter}
            onChange={setYearFilter}
          />
          <DateRangeFilter
            label="Opened"
            value={dateRange}
            onChange={setDateRange}
          />
          <FilterMenu
            label="Category"
            icon={TagIcon}
            options={ticketCategories.filter((c) =>
              all.some((r) => r.group === c),
            )}
            selected={categoryFilter}
            onChange={setCategoryFilter}
          />
          <FilterMenu
            label="Assigned to"
            icon={UserCogIcon}
            options={assignees}
            selected={assigneeFilter}
            onChange={setAssigneeFilter}
          />
          <FilterMenu
            label="Priority"
            icon={FlagIcon}
            options={[...requestPriorities]}
            selected={priorityFilter}
            onChange={setPriorityFilter}
          />
          <FilterMenu
            label="Location"
            icon={MapPinIcon}
            options={locations}
            selected={locationFilter}
            onChange={setLocationFilter}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bento grid: flat cells on a border-coloured background, so the 1px
          gaps between them read as dividers. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 md:col-span-2 lg:col-span-4 xl:grid-cols-5">
            <StatCard
              className="sm:col-span-2 xl:col-span-1"
              label="Total tickets"
              value={<AnimatedNumber value={rows.length} />}
              footer={
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {ticketStatuses.map((status) => (
                    <span
                      key={status}
                      className="inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          ticketStatusStyles[status].dot,
                        )}
                      />
                      <span className="font-medium text-foreground tabular-nums">
                        {rows.filter((r) => r.status === status).length}
                      </span>
                      {status.toLowerCase()}
                    </span>
                  ))}
                </span>
              }
            />
            <StatCard
              label="Open vs closed"
              value={
                <>
                  <AnimatedNumber value={open} delay={80} />
                  <span className="mx-1 text-sm font-normal text-muted-foreground">
                    open ·
                  </span>
                  <AnimatedNumber value={closed} delay={80} />
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    closed
                  </span>
                </>
              }
              footer={
                <span className="flex w-full items-center gap-2 text-muted-foreground">
                  <span
                    className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full"
                    title={`${open} open · ${closed} closed`}
                  >
                    <span
                      className={cn(
                        "h-full",
                        growClass,
                        ticketStatusStyles.Open.dot,
                      )}
                      style={{
                        width: ready ? percent(open, open + closed) : 0,
                      }}
                    />
                    <span
                      className={cn(
                        "h-full flex-1",
                        ticketStatusStyles.Closed.dot,
                      )}
                    />
                  </span>
                  {percent(closed, open + closed)} closed
                </span>
              }
            />
            <StatCard
              label="Total resolve time"
              value={formatHours(totalMinutes)}
              footer={
                <span className="text-muted-foreground">
                  across {times.length.toLocaleString()} resolved tickets
                </span>
              }
            />
            <StatCard
              label="Average resolve time"
              value={times.length ? formatMinutes(average(times)) : "–"}
              footer={
                <span className="text-muted-foreground">
                  median{" "}
                  <span className="font-medium text-foreground">
                    {times.length ? formatMinutes(median(times)) : "–"}
                  </span>
                  {" · "}
                  {percent(withinHour, times.length)} fixed within 1 hr
                </span>
              }
            />
            <StatCard
              label="Most requested"
              value={
                <span className="text-xl">
                  {topGroup?.n ? topGroup.g : "–"}
                </span>
              }
              footer={
                <span className="text-muted-foreground">
                  {topGroup?.n
                    ? `${topGroup.n} tickets · ${percent(topGroup.n, rows.length)} of all`
                    : "No tickets"}
                </span>
              }
            />
          </div>

          <MonthlyCard rows={rows} />
          <MostRequestedCard
            rows={dimRows}
            active={categoryFilter}
            onToggle={toggleCategory}
          />
          <TopIssuesCard rows={rows} />
          <TechnicianCard rows={rows} />
        </div>
      </div>
    </div>
  );
}
