"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  AwardIcon,
  BuildingIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleDotIcon,
  DownloadIcon,
  LaptopIcon,
  MinusIcon,
  PrinterIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { FilterMenu } from "@/components/laptop-inventory-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  REFRESH_YEARS,
  average,
  formatYears,
  gradeColorClass,
  gradeHex,
  gradeInfo,
  gradeLaptop,
  gradeTrend,
  grades,
  isRetiredAt,
  type Grade,
  type GradedLaptop,
} from "@/lib/laptop-analytics";
import {
  formatDate,
  parseDate,
  statusStyles,
  statuses,
  warrantyInfo,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const UNASSIGNED = "Unassigned";

type SortKey = "score" | "age" | "usage";
const sortOptions: { key: SortKey; label: string }[] = [
  { key: "score", label: "Worst first" },
  { key: "age", label: "Oldest first" },
  { key: "usage", label: "Most used" },
];

const gradeChartConfig = Object.fromEntries(
  grades.map((g) => [g, { label: gradeInfo[g].label, theme: gradeHex[g] }]),
) satisfies ChartConfig;

const barChartConfig = {
  value: {
    label: "Laptops",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  alert: {
    label: "Past refresh",
    theme: { light: "#d03b3b", dark: "#d03b3b" },
  },
} satisfies ChartConfig;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function recommendation(r: GradedLaptop, today: Date) {
  if (r.laptop.status === "Retired") return "Dispose or recycle";
  // D/F actions are time-critical, so derive the wording from the actual
  // refresh date instead of a fixed per-grade label — otherwise a laptop
  // due in a few weeks can still read "Replace in 6 months".
  if (r.grade === "D" || r.grade === "F") {
    const daysUntil = Math.ceil(
      (r.refreshDate.getTime() - today.getTime()) / 86_400_000,
    );
    if (daysUntil <= 0) return "Replace now";
    if (daysUntil <= 60) {
      const weeks = Math.max(1, Math.round(daysUntil / 7));
      return `Replace in ${weeks} week${weeks === 1 ? "" : "s"}`;
    }
    const months = Math.max(1, Math.round(daysUntil / 30));
    return `Replace in ${months} month${months === 1 ? "" : "s"}`;
  }
  return gradeInfo[r.grade].action;
}

function exportReport(rows: GradedLaptop[], today: Date) {
  const header = [
    "Asset tag",
    "Brand",
    "Model",
    "Handler",
    "Department",
    "Status",
    "Purchase date",
    "Age (years)",
    "Usage time (years)",
    "Utilization",
    "Health score",
    "Grade",
    "Grade label",
    "Refresh due",
    "Warranty",
    "Recommendation",
  ];
  const lines = rows.map((r) =>
    [
      r.laptop.assetTag,
      r.laptop.brand,
      r.laptop.model,
      r.laptop.handler ?? UNASSIGNED,
      r.laptop.department ?? "",
      r.laptop.status,
      r.laptop.purchaseDate,
      r.ageYears.toFixed(1),
      r.usageYears.toFixed(1),
      percent(r.utilization),
      r.score,
      r.grade,
      gradeInfo[r.grade].label,
      formatDate(r.refreshDate),
      warrantyInfo(r.laptop, today).state,
      recommendation(r, today),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laptop-grading-report-${today.toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// A flat cell in the bento grid; the grid's 1px gaps draw the dividers.
function BentoCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "min-w-0 rounded-none bg-background shadow-none ring-0 break-inside-avoid",
        className,
      )}
      {...props}
    />
  );
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {children}
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {color && (
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

// Change vs. a year ago. `goodWhenUp` decides whether a rise is green or red.
function Delta({
  value,
  goodWhenUp,
  format,
}: {
  value: number;
  goodWhenUp: boolean;
  format: (value: number) => string;
}) {
  const flat = Math.abs(value) < 0.05;
  const good = value > 0 === goodWhenUp;
  const Icon = flat ? MinusIcon : value > 0 ? ChevronUpIcon : ChevronDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums [&_svg]:size-3",
        flat
          ? "text-muted-foreground"
          : good
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon />
      {format(Math.abs(value))}
    </span>
  );
}

function StatCard({
  label,
  value,
  children,
  footer,
  className,
}: {
  className?: string;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <BentoCard className={className}>
      <CardHeader>
        <CardTitle className="text-xs font-normal tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {children && <CardAction>{children}</CardAction>}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
      <CardFooter className="gap-1 rounded-none border-t-0 bg-background pt-0 text-xs">
        {footer}
      </CardFooter>
    </BentoCard>
  );
}

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-md text-[11px] font-semibold",
          gradeColorClass[grade],
          grade === "C" ? "text-foreground" : "text-white",
        )}
      >
        {grade}
      </span>
      <span className="text-muted-foreground">{gradeInfo[grade].label}</span>
    </span>
  );
}

function GradeChips({
  active,
  onToggle,
}: {
  active: Grade[];
  onToggle: (grade: Grade) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 print:hidden">
      {grades.map((g) => {
        const shown = active.length === 0 || active.includes(g);
        return (
          <button
            key={g}
            type="button"
            aria-pressed={active.includes(g)}
            onClick={() => onToggle(g)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active.includes(g)
                ? "border-foreground/40 bg-muted"
                : "border-border hover:bg-muted/60",
              !shown && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-2.5 rounded-full",
                gradeColorClass[g],
                !shown && "opacity-30",
              )}
            />
            {gradeInfo[g].label}
          </button>
        );
      })}
    </div>
  );
}

type TrendRow = {
  label: string;
  projected: boolean;
} & Partial<Record<Grade | `${Grade}_p`, number>> & {
    counts: Record<Grade, number>;
  };

function GradeTrendCard({
  laptops,
  today,
  visible,
  active,
  onToggle,
}: {
  laptops: GradedLaptop["laptop"][];
  today: Date;
  visible: Grade[];
  active: Grade[];
  onToggle: (grade: Grade) => void;
}) {
  const data = useMemo(() => {
    const points = gradeTrend(laptops, today);
    const nowIndex = points.findIndex((p) => p.projected) - 1;
    return points.map((p, i): TrendRow => {
      const row: TrendRow = {
        label:
          i === nowIndex
            ? "Today"
            : p.date.toLocaleDateString("en-GB", {
                month: "short",
                year: "2-digit",
              }),
        projected: p.projected,
        counts: p.counts,
      };
      // Actuals and projection are separate series so the projection can be
      // dashed; both include today so the lines join up.
      for (const g of grades) {
        if (i <= nowIndex) row[g] = p.counts[g];
        if (i >= nowIndex) row[`${g}_p`] = p.counts[g];
      }
      return row;
    });
  }, [laptops, today]);

  const todayIndex = data.findIndex((d) => d.label === "Today");
  // "Today" gets its own reference-line label, so exclude it from the
  // regular tick spacing to keep it from overlapping the nearest month tick.
  const ticks = data
    .filter((_, i) => i !== todayIndex && (i - todayIndex) % 3 === 0)
    .map((d) => d.label);

  return (
    <BentoCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">Laptops by grade over time</CardTitle>
        <CardDescription>
          Monthly count per grade · dashed lines project the next 12 months if
          nothing is replaced
        </CardDescription>
        <CardAction className="max-lg:col-span-2 max-lg:col-start-1 max-lg:row-start-3 max-lg:justify-self-start">
          <GradeChips active={active} onToggle={onToggle} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={gradeChartConfig}
          className="aspect-auto h-72 w-full"
        >
          <LineChart data={data} margin={{ left: -16, right: 12, top: 24 }}>
            <CartesianGrid
              className="stroke-border"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              ticks={ticks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
            />
            <ReferenceArea
              x1="Today"
              x2={data.at(-1)?.label}
              fill="var(--muted)"
              fillOpacity={0.5}
              label={{
                value: "Projected",
                position: "insideTopRight",
                className: "fill-muted-foreground text-[10px]",
              }}
            />
            <ReferenceLine
              x="Today"
              className="stroke-muted-foreground/60"
              label={{
                value: "Today",
                position: "top",
                className: "fill-muted-foreground text-[10px]",
              }}
            />
            <ChartTooltip
              cursor={{ className: "stroke-foreground/30" }}
              content={({ active: open, payload }) => {
                const row = payload?.[0]?.payload as TrendRow | undefined;
                if (!open || !row) return null;
                return (
                  <TooltipBox>
                    <div className="font-medium">
                      {row.label}
                      {row.projected && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          projected
                        </span>
                      )}
                    </div>
                    {visible.map((g) => (
                      <TooltipRow
                        key={g}
                        color={`var(--color-${g})`}
                        label={gradeInfo[g].label}
                        value={row.counts[g]}
                      />
                    ))}
                  </TooltipBox>
                );
              }}
            />
            {visible.map((g) => (
              <Line
                key={g}
                dataKey={g}
                type="stepAfter"
                stroke={`var(--color-${g})`}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  className: "stroke-background",
                }}
                isAnimationActive={false}
              />
            ))}
            {visible.map((g) => (
              <Line
                key={`${g}_p`}
                dataKey={`${g}_p`}
                type="stepAfter"
                stroke={`var(--color-${g})`}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </BentoCard>
  );
}

function GradeDistributionCard({
  rows,
  active,
  onToggle,
}: {
  rows: GradedLaptop[];
  active: Grade[];
  onToggle: (grade: Grade) => void;
}) {
  const counts = grades.map((g) => rows.filter((r) => r.grade === g).length);
  const max = Math.max(1, ...counts);
  return (
    <BentoCard>
      <CardHeader>
        <CardTitle className="text-base">Grade distribution</CardTitle>
        <CardDescription>Click grades to filter everything</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-1">
        {grades.map((grade, i) => {
          const selected = active.includes(grade);
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(grade)}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected && "bg-muted",
                active.length > 0 && !selected && "opacity-50",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <GradeBadge grade={grade} />
                <span className="tabular-nums">
                  <span className="font-semibold">{counts[i]}</span>{" "}
                  <span className="text-muted-foreground">
                    {rows.length ? percent(counts[i] / rows.length) : "0%"}
                  </span>
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    gradeColorClass[grade],
                  )}
                  style={{ width: `${(counts[i] / max) * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </CardContent>
    </BentoCard>
  );
}

// One bar per laptop: the track is its age, the filled part is the time it
// has spent with users. Easier to read laptop by laptop than a scatter plot.
function AgeUsageCard({ rows }: { rows: GradedLaptop[] }) {
  const maxYears = Math.max(
    REFRESH_YEARS + 1,
    Math.ceil(Math.max(0, ...rows.map((r) => r.ageYears))),
  );
  const ticks = Array.from({ length: maxYears + 1 }, (_, i) => i);
  const pos = (years: number) => `${(years / maxYears) * 100}%`;
  const sorted = [...rows].sort((a, b) => b.ageYears - a.ageYears);

  return (
    <BentoCard className="gap-0 pb-0 lg:col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Age vs. usage time</CardTitle>
        <CardDescription>
          Oldest first · the full bar is the laptop&apos;s age, the coloured
          part is time spent with users
        </CardDescription>
      </CardHeader>
      <div className="grid grid-cols-[8.5rem_1fr_6.5rem] gap-x-3 border-y border-border bg-muted px-4 py-2 text-[11px] text-muted-foreground">
        <span>Laptop</span>
        <span className="relative h-4">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 tabular-nums"
              style={{ left: pos(t) }}
            >
              {t}
            </span>
          ))}
        </span>
        <span className="text-right">Used / age</span>
      </div>
      <div className="max-h-80 overflow-auto scrollbar-none print:max-h-none [&::-webkit-scrollbar]:hidden print:overflow-visible">
        {sorted.map((r) => (
          <div
            key={r.laptop.id}
            title={`${r.laptop.brand} ${r.laptop.model} · ${r.laptop.handler ?? UNASSIGNED} · ${gradeInfo[r.grade].label}`}
            className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-x-3 px-4 py-1.5 text-xs hover:bg-muted/40"
          >
            <span className="truncate font-medium whitespace-nowrap" title={r.laptop.assetTag}>
              {r.laptop.assetTag}
            </span>
            <span className="relative h-3">
              {/* Refresh threshold */}
              <span
                className="absolute -inset-y-1.5 w-px bg-[#d03b3b]/60"
                style={{ left: pos(REFRESH_YEARS) }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-muted"
                style={{ width: pos(r.ageYears) }}
              />
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-r-[4px]",
                  gradeColorClass[r.grade],
                )}
                style={{ width: pos(r.usageYears) }}
              />
            </span>
            <span className="text-right tabular-nums">
              <span className="font-medium">{r.usageYears.toFixed(1)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {formatYears(r.ageYears)}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        {grades.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", gradeColorClass[g])} />
            {gradeInfo[g].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px bg-[#d03b3b]/60" />
          {REFRESH_YEARS}-yr refresh
        </span>
      </div>
    </BentoCard>
  );
}

type BarRow = {
  label: string;
  value: number;
  alert: boolean;
  detail: string;
};

function ColumnCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: BarRow[];
}) {
  return (
    <BentoCard>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <ChartContainer
          config={barChartConfig}
          className="aspect-auto h-72 w-full"
        >
          <BarChart data={data} margin={{ left: 8, right: 8, top: 20, bottom: 4 }}>
            <CartesianGrid
              className="stroke-border"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval={0}
              fontSize={10}
              angle={-40}
              textAnchor="end"
              height={52}
            />
            <ChartTooltip
              cursor={{ className: "fill-muted" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as BarRow | undefined;
                if (!active || !row) return null;
                return (
                  <TooltipBox>
                    <div className="font-medium">{row.label}</div>
                    <div className="max-w-48 text-muted-foreground">
                      {row.detail}
                    </div>
                  </TooltipBox>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell
                  key={d.label}
                  fill={d.alert ? "var(--color-alert)" : "var(--color-value)"}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                offset={6}
                className="fill-foreground text-xs font-medium"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </BentoCard>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#cde2fb] dark:bg-[#184f95]/60">
        <span
          className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#6da7ec]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="w-9 tabular-nums">{percent(value)}</span>
    </span>
  );
}

function GradeMix({ rows }: { rows: GradedLaptop[] }) {
  return (
    <span className="flex h-3 w-full min-w-24 gap-0.5 overflow-hidden rounded-[4px]">
      {grades.map((g) => {
        const count = rows.filter((r) => r.grade === g).length;
        if (count === 0) return null;
        return (
          <span
            key={g}
            title={`${gradeInfo[g].label}: ${count}`}
            className={gradeColorClass[g]}
            style={{ flexGrow: count }}
          />
        );
      })}
    </span>
  );
}

const th =
  "sticky top-0 z-10 h-9 bg-muted px-4 shadow-[inset_0_1px_0_var(--color-border),inset_0_-1px_0_var(--color-border)] text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground";
const td = "border-b border-border px-4 py-2 whitespace-nowrap";

export function LaptopAnalyticsDashboard({ laptops }: { laptops: Laptop[] }) {
  const today = useToday();
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<LaptopStatus[]>([]);
  const [gradeFilter, setGradeFilter] = useState<Grade[]>([]);
  const [sort, setSort] = useState<SortKey>("score");

  const departments = useMemo(
    () =>
      [
        ...new Set(laptops.map((l) => l.department ?? UNASSIGNED)),
      ].sort(),
    [laptops],
  );
  const brands = useMemo(
    () => [...new Set(laptops.map((l) => l.brand))].sort(),
    [laptops],
  );

  const graded = useMemo(
    () => (today ? laptops.map((l) => gradeLaptop(l, today)) : []),
    [today, laptops],
  );

  // Filtered by everything except grade, so the grade charts can still
  // show the grades that are filtered out.
  const dimRows = useMemo(
    () =>
      graded.filter(
        ({ laptop }) =>
          (departmentFilter.length === 0 ||
            departmentFilter.includes(laptop.department ?? UNASSIGNED)) &&
          (brandFilter.length === 0 || brandFilter.includes(laptop.brand)) &&
          (statusFilter.length === 0 || statusFilter.includes(laptop.status)),
      ),
    [graded, departmentFilter, brandFilter, statusFilter],
  );

  const rows = useMemo(
    () =>
      gradeFilter.length === 0
        ? dimRows
        : dimRows.filter((r) => gradeFilter.includes(r.grade)),
    [dimRows, gradeFilter],
  );

  const trendLaptops = useMemo(() => dimRows.map((r) => r.laptop), [dimRows]);

  const reportRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "score"
          ? a.score - b.score
          : sort === "age"
            ? b.ageYears - a.ageYears
            : b.usageYears - a.usageYears,
      ),
    [rows, sort],
  );

  const hasFilters =
    departmentFilter.length > 0 ||
    brandFilter.length > 0 ||
    statusFilter.length > 0 ||
    gradeFilter.length > 0;

  function clearFilters() {
    setDepartmentFilter([]);
    setBrandFilter([]);
    setStatusFilter([]);
    setGradeFilter([]);
  }

  function toggleGrade(grade: Grade) {
    setGradeFilter((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
  }

  if (!today) {
    return <p className="text-sm text-muted-foreground">Loading analytics…</p>;
  }

  const active = rows.filter((r) => r.laptop.status !== "Retired");
  const avgScore = Math.round(average(active.map((r) => r.score)));
  const fleetGrade = grades.find((g) => avgScore >= gradeInfo[g].min) ?? "F";
  const dueForReplacement = active.filter(
    (r) => r.grade === "D" || r.grade === "F",
  );
  const warrantyExpired = active.filter(
    (r) => warrantyInfo(r.laptop, today).state === "Expired",
  );

  // The same laptops as they stood a year ago, for the stat deltas.
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const activeYearAgo = active
    .filter(
      ({ laptop }) =>
        parseDate(laptop.purchaseDate) <= yearAgo &&
        !isRetiredAt(laptop, yearAgo),
    )
    .map(({ laptop }) => gradeLaptop(laptop, yearAgo, { current: false }));
  const then = {
    score: average(activeYearAgo.map((r) => r.score)),
    age: average(activeYearAgo.map((r) => r.ageYears)),
    utilization: average(activeYearAgo.map((r) => r.utilization)),
    due: activeYearAgo.filter((r) => r.grade === "D" || r.grade === "F").length,
  };

  const ageBands: BarRow[] = [
    { label: "<1 yr", from: 0, to: 1 },
    { label: "1–2", from: 1, to: 2 },
    { label: "2–3", from: 2, to: 3 },
    { label: "3–4", from: 3, to: 4 },
    { label: "4–5", from: 4, to: 5 },
    { label: "5+", from: 5, to: Infinity },
  ].map((band) => {
    const inBand = rows.filter(
      (r) => r.ageYears >= band.from && r.ageYears < band.to,
    );
    return {
      label: band.label,
      value: inBand.length,
      alert: band.from >= REFRESH_YEARS,
      detail: `${inBand.length} laptop${inBand.length === 1 ? "" : "s"}${
        inBand.length
          ? ` · avg usage ${percent(average(inBand.map((r) => r.utilization)))}`
          : ""
      }`,
    };
  });

  const thisYear = today.getFullYear();
  const yearTick = (year: number) => `'${String(year).slice(-2)}`;
  const forecast: BarRow[] = [
    {
      label: "Overdue",
      match: (r: GradedLaptop) => r.refreshDate <= today,
      alert: true,
    },
    ...[0, 1, 2, 3].map((offset) => ({
      label: yearTick(thisYear + offset),
      match: (r: GradedLaptop) =>
        r.refreshDate > today &&
        r.refreshDate.getFullYear() === thisYear + offset,
      alert: false,
    })),
    {
      label: `${yearTick(thisYear + 4)}+`,
      match: (r: GradedLaptop) => r.refreshDate.getFullYear() >= thisYear + 4,
      alert: false,
    },
  ].map((bucket) => {
    const due = active.filter(bucket.match);
    return {
      label: bucket.label,
      value: due.length,
      alert: bucket.alert,
      detail: due.length
        ? due.map((r) => r.laptop.assetTag).join(", ")
        : "None due",
    };
  });

  const departmentStats = [
    ...new Set(rows.map((r) => r.laptop.department ?? UNASSIGNED)),
  ]
    .map((department) => {
      const inDept = rows.filter(
        (r) => (r.laptop.department ?? UNASSIGNED) === department,
      );
      return {
        department,
        rows: inDept,
        avgAge: average(inDept.map((r) => r.ageYears)),
        avgUsage: average(inDept.map((r) => r.usageYears)),
        utilization: average(inDept.map((r) => r.utilization)),
        avgScore: Math.round(average(inDept.map((r) => r.score))),
        due: inDept.filter(
          (r) =>
            r.laptop.status !== "Retired" &&
            (r.grade === "D" || r.grade === "F"),
        ).length,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore);

  const vsLastYear = (
    <span className="text-muted-foreground">vs last year</span>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Laptop Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Fleet grading by age and usage time · as of {formatDate(today)} ·{" "}
            {rows.length} of {graded.length} laptops
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <FilterMenu
            label="Department"
            icon={BuildingIcon}
            options={departments}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <FilterMenu
            label="Brand"
            icon={LaptopIcon}
            options={brands}
            selected={brandFilter}
            onChange={setBrandFilter}
          />
          <FilterMenu
            label="Grade"
            icon={AwardIcon}
            options={grades.map((g) => gradeInfo[g].label)}
            selected={gradeFilter.map((g) => gradeInfo[g].label)}
            onChange={(labels) =>
              setGradeFilter(
                grades.filter((g) => labels.includes(gradeInfo[g].label)),
              )
            }
          />
          <FilterMenu
            label="Status"
            icon={CircleDotIcon}
            options={statuses}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon />
              Clear
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <PrinterIcon />
            Print / PDF
          </Button>
          <Button onClick={() => exportReport(reportRows, today)}>
            <DownloadIcon />
            Export report
          </Button>
        </div>
      </div>

      {/* Bento grid: flat cells on a border-coloured background, so the 1px
          gaps between them read as dividers. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
          {/* Stat row: its own five-column grid inside the bento */}
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 md:col-span-2 lg:col-span-4 xl:grid-cols-5">
            <StatCard
              className="sm:col-span-2 xl:col-span-1"
              label="Total laptops"
              value={rows.length}
              footer={
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {statuses.map((status) => (
                    <span
                      key={status}
                      className="inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          statusStyles[status].dot,
                        )}
                      />
                      <span className="font-medium text-foreground tabular-nums">
                        {rows.filter((r) => r.laptop.status === status).length}
                      </span>
                      {status.toLowerCase()}
                    </span>
                  ))}
                </span>
              }
            >
              <span className="text-xs text-muted-foreground">
                {active.length} active
              </span>
            </StatCard>
            <StatCard
              label="Fleet health score"
              value={
                <>
                  {active.length ? avgScore : "–"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / 100
                  </span>
                </>
              }
              footer={
                <>
                  <Delta
                    value={avgScore - then.score}
                    goodWhenUp
                    format={(v) => `${v.toFixed(0)} pts`}
                  />
                  {vsLastYear}
                </>
              }
            >
              {active.length > 0 && (
                <span className="text-xs">
                  <GradeBadge grade={fleetGrade} />
                </span>
              )}
            </StatCard>
            <StatCard
              label="Average age"
              value={formatYears(average(active.map((r) => r.ageYears)))}
              footer={
                <>
                  <Delta
                    value={average(active.map((r) => r.ageYears)) - then.age}
                    goodWhenUp={false}
                    format={(v) => formatYears(v)}
                  />
                  {vsLastYear}
                </>
              }
            />
            <StatCard
              label="Average utilization"
              value={percent(average(active.map((r) => r.utilization)))}
              footer={
                <span className="text-muted-foreground">
                  {formatYears(average(active.map((r) => r.usageYears)))} with
                  users on average
                </span>
              }
            />
            <StatCard
              label="Due for replacement"
              value={dueForReplacement.length}
              footer={
                <>
                  <Delta
                    value={dueForReplacement.length - then.due}
                    goodWhenUp={false}
                    format={(v) => v.toFixed(0)}
                  />
                  {vsLastYear}
                  <span className="ml-auto text-muted-foreground">
                    {warrantyExpired.length} out of warranty
                  </span>
                </>
              }
            />
          </div>

          <GradeTrendCard
            laptops={trendLaptops}
            today={today}
            visible={gradeFilter.length ? gradeFilter : grades}
            active={gradeFilter}
            onToggle={toggleGrade}
          />
          <GradeDistributionCard
            rows={dimRows}
            active={gradeFilter}
            onToggle={toggleGrade}
          />

          <AgeUsageCard rows={rows} />
          <ColumnCard
            title="Age distribution"
            description={`Red bars are past the ${REFRESH_YEARS}-year refresh`}
            data={ageBands}
          />
          <ColumnCard
            title="Replacement forecast"
            description={`Laptops reaching ${REFRESH_YEARS} years, by year`}
            data={forecast}
          />

          <BentoCard className="gap-0 pb-0 md:col-span-2 lg:col-span-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">By department</CardTitle>
              <CardDescription>
                Sorted by average health score, lowest first
              </CardDescription>
            </CardHeader>
            <div className="max-h-80 overflow-auto scrollbar-none print:max-h-none [&::-webkit-scrollbar]:hidden print:overflow-visible">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={th}>Department</th>
                    <th className={cn(th, "text-right")}>Laptops</th>
                    <th className={cn(th, "text-right")}>Avg age</th>
                    <th className={cn(th, "text-right")}>Avg usage</th>
                    <th className={th}>Utilization</th>
                    <th className={cn(th, "text-right")}>Avg score</th>
                    <th className={cn(th, "w-48")}>Grade mix</th>
                    <th className={cn(th, "text-right")}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map((d) => (
                    <tr
                      key={d.department}
                      className="hover:bg-muted/40 [&:last-child>td]:border-b-0"
                    >
                      <td className={cn(td, "font-medium")}>{d.department}</td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {d.rows.length}
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {formatYears(d.avgAge)}
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {formatYears(d.avgUsage)}
                      </td>
                      <td className={td}>
                        <Meter value={d.utilization} />
                      </td>
                      <td
                        className={cn(
                          td,
                          "text-right font-semibold tabular-nums",
                        )}
                      >
                        {d.avgScore}
                      </td>
                      <td className={td}>
                        <GradeMix rows={d.rows} />
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {d.due > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlertIcon className="size-3 text-[#d03b3b]" />
                            {d.due}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BentoCard>

          <BentoCard className="gap-0 pb-0 md:col-span-2 lg:col-span-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Laptop grading report</CardTitle>
              <CardDescription>
                {gradeFilter.length
                  ? `Showing ${gradeFilter.map((g) => gradeInfo[g].label).join(", ")} · ${reportRows.length} laptops`
                  : `${reportRows.length} laptops`}
              </CardDescription>
              <CardAction className="flex gap-1 print:hidden">
                {sortOptions.map((option) => (
                  <Button
                    key={option.key}
                    size="sm"
                    variant={sort === option.key ? "secondary" : "ghost"}
                    onClick={() => setSort(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </CardAction>
            </CardHeader>
            <div className="max-h-[28rem] overflow-auto scrollbar-none print:max-h-none [&::-webkit-scrollbar]:hidden print:overflow-visible">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={th}>Asset</th>
                    <th className={th}>Laptop</th>
                    <th className={th}>Handler</th>
                    <th className={th}>Status</th>
                    <th className={cn(th, "text-right")}>Age</th>
                    <th className={cn(th, "text-right")}>Usage time</th>
                    <th className={th}>Utilization</th>
                    <th className={cn(th, "text-right")}>Score</th>
                    <th className={th}>Grade</th>
                    <th className={th}>Refresh due</th>
                    <th className={th}>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => (
                    <tr
                      key={r.laptop.id}
                      className="hover:bg-muted/40 [&:last-child>td]:border-b-0"
                    >
                      <td className={cn(td, "font-medium")}>
                        {r.laptop.assetTag}
                      </td>
                      <td className={td}>
                        {r.laptop.brand} {r.laptop.model}
                      </td>
                      <td className={td}>
                        {r.laptop.handler ?? (
                          <span className="text-muted-foreground">
                            {UNASSIGNED}
                          </span>
                        )}
                        {r.laptop.department && (
                          <span className="block text-[11px] text-muted-foreground">
                            {r.laptop.department}
                          </span>
                        )}
                      </td>
                      <td className={td}>{r.laptop.status}</td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {formatYears(r.ageYears)}
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {formatYears(r.usageYears)}
                      </td>
                      <td className={td}>
                        <Meter value={r.utilization} />
                      </td>
                      <td
                        className={cn(
                          td,
                          "text-right font-semibold whitespace-normal tabular-nums",
                        )}
                      >
                        {r.score}
                        {r.penalties.length > 0 && (
                          <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                            {r.penalties.join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        <GradeBadge grade={r.grade} />
                      </td>
                      <td
                        className={cn(
                          td,
                          r.laptop.status !== "Retired" &&
                            r.refreshDate <= today &&
                            "font-medium",
                        )}
                      >
                        {formatDate(r.refreshDate)}
                      </td>
                      <td className={td}>{recommendation(r, today)}</td>
                    </tr>
                  ))}
                  {reportRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No laptops match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        How grades work: every laptop starts at 100 and loses 10 points per year
        of age and 6 points per year spent with a user. On top of that, laptops
        currently in repair lose 10 and a missing charger loses 5 — those
        deductions are listed under the score when they apply. Retired laptops
        score 0. Grades: Brand new (A) ≥ 80, Good (B) ≥ 65, Fair (C) ≥ 50,
        Poor (D) ≥ 35, End of life (F) below 35. Recommendations for poor and
        end-of-life laptops follow the refresh date, not a fixed grade label.
      </p>
    </div>
  );
}
