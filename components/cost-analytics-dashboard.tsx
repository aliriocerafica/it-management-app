"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  BoxesIcon,
  BuildingIcon,
  CalendarIcon,
  CircleDotIcon,
  DownloadIcon,
  PrinterIcon,
  XIcon,
} from "lucide-react";

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
import {
  accessoryConfigs,
  type Accessory,
  type AccessoryKind,
} from "@/lib/accessories";
import {
  formatPrice,
  saleOf,
  statusStyles,
  statuses,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const UNASSIGNED = "Unassigned / stock";
const LAPTOPS = "Laptops";

type Group = "laptop" | "accessory" | "repair";

const REPAIRS = "Laptop repairs";

type CostItem = {
  id: string;
  group: Group;
  category: string;
  assetTag: string;
  brand: string;
  model: string;
  handler: string | null;
  department: string;
  status: LaptopStatus;
  purchaseDate: string;
  year: string;
  price: number | null;
  // Laptops only: what was spent repairing it, and when.
  repairCost: number | null;
  repairDate: string | null;
  // Laptops only: what it sold for, and when. Null if not sold.
  salePrice: number | null;
  saleDate: string | null;
};

// Book value is straight-line over this many years, to zero.
const USEFUL_LIFE_YEARS = 3;

// What an asset is still worth on the books today. Sold or retired assets
// are off the books.
function bookValue(item: CostItem, today: Date) {
  if (item.price == null || item.status === "Retired") return 0;
  const ageYears =
    (today.getTime() - new Date(`${item.purchaseDate}T00:00:00`).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);
  return item.price * Math.min(1, Math.max(0, 1 - ageYears / USEFUL_LIFE_YEARS));
}

// Number colors by meaning: money spent is red, money coming back (sales,
// returns, ROI) is green, value still held on the books is blue.
const tone = {
  cost: "text-red-600 dark:text-red-400",
  gain: "text-emerald-600 dark:text-emerald-400",
  value: "text-blue-600 dark:text-blue-400",
};

// Green when it's a gain, red when it's a loss.
function signedTone(amount: number) {
  return amount >= 0 ? tone.gain : tone.cost;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

// One payment: a purchase (dated by purchase date) or a repair.
type CostEvent = {
  group: Group;
  date: string;
  amount: number;
};

// Every month from the first payment to the last, so gaps show as empty.
function monthRange(first: string, last: string) {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthLabel(month: string, style: "short" | "long" = "short") {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-PH", {
    month: style === "short" ? "short" : "long",
    year: style === "short" ? "2-digit" : "numeric",
  });
}

const chartConfig = {
  laptop: {
    label: "Laptops",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  accessory: {
    label: "Accessories",
    theme: { light: "#d98a1c", dark: "#e9a23b" },
  },
  repair: {
    label: "Repairs",
    theme: { light: "#6250d6", dark: "#9085e9" },
  },
} satisfies ChartConfig;

const groupBarClass: Record<Group, string> = {
  laptop: "bg-[#2a78d6] dark:bg-[#3987e5]",
  accessory: "bg-[#d98a1c] dark:bg-[#e9a23b]",
  repair: "bg-[#6250d6] dark:bg-[#9085e9]",
};

const groups: Group[] = ["laptop", "accessory", "repair"];

function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {groups.map((group) => (
        <span key={group} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-xs", groupBarClass[group])} />
          {chartConfig[group].label}
        </span>
      ))}
    </div>
  );
}

// The tooltip for a period's stacked bar: each part, then the total.
function SpendTooltip({
  title,
  row,
}: {
  title: string;
  row: Record<Group, number>;
}) {
  return (
    <TooltipBox>
      <div className="font-medium">{title}</div>
      {groups.map((group) => (
        <TooltipRow
          key={group}
          color={`var(--color-${group})`}
          label={chartConfig[group].label}
          value={wholePeso(row[group])}
        />
      ))}
      <TooltipRow
        label="Total"
        value={wholePeso(row.laptop + row.accessory + row.repair)}
      />
    </TooltipBox>
  );
}

// Stacked laptop / accessory / repair bars, one per period.
function SpendChart({
  data,
  tooltipTitle,
}: {
  data: ({ key: string; label: string } & Record<Group, number>)[];
  tooltipTitle: (key: string) => string;
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
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
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={56}
          tickFormatter={compactPeso}
        />
        <ChartTooltip
          cursor={{ className: "fill-muted/50" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!active || !row) return null;
            return <SpendTooltip title={tooltipTitle(row.key)} row={row} />;
          }}
        />
        {groups.map((group, index) => (
          <Bar
            key={group}
            dataKey={group}
            stackId="spend"
            fill={`var(--color-${group})`}
            // Only the top segment gets rounded corners.
            radius={index === groups.length - 1 ? [4, 4, 0, 0] : undefined}
            animationDuration={900}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// Totals per period key (a year or a yyyy-mm month) for the given keys.
function spendByPeriod(
  events: CostEvent[],
  keyOf: (date: string) => string,
  keys: string[],
) {
  const map = new Map(
    keys.map((key) => [key, { laptop: 0, accessory: 0, repair: 0 }]),
  );
  for (const event of events) {
    const entry = map.get(keyOf(event.date));
    if (entry) entry[event.group] += event.amount;
  }
  return map;
}

// "₱1.2M" / "₱85K" for axis ticks, where full amounts don't fit.
function compactPeso(amount: number) {
  return `₱${new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount)}`;
}

function wholePeso(amount: number) {
  return formatPrice(Math.round(amount));
}

function sum(items: CostItem[]) {
  return items.reduce((total, item) => total + (item.price ?? 0), 0);
}

function priced(items: CostItem[]) {
  return items.filter((item) => item.price != null);
}

function toCostItems(laptops: Laptop[], accessories: Accessory[]): CostItem[] {
  const laptopDepartment = new Map(
    laptops.map((laptop) => [laptop.id, laptop.department]),
  );
  return [
    ...laptops.map<CostItem>((laptop) => {
      const sale = saleOf(laptop);
      const salePrice = sale ? Number(sale.price.replace(/[^\d.]/g, "")) : NaN;
      return {
      salePrice: Number.isFinite(salePrice) ? salePrice : null,
      saleDate: sale && Number.isFinite(salePrice) ? sale.date : null,
      id: laptop.id,
      group: "laptop",
      category: LAPTOPS,
      assetTag: laptop.assetTag,
      brand: laptop.brand,
      model: laptop.model,
      handler: laptop.handler,
      department: laptop.department || UNASSIGNED,
      status: laptop.status,
      purchaseDate: laptop.purchaseDate,
      year: laptop.purchaseDate.slice(0, 4),
      price: laptop.price ?? null,
      repairCost: laptop.repairCost ?? null,
      repairDate: laptop.repairDate ?? null,
      };
    }),
    ...accessories.map<CostItem>((item) => ({
      id: item.id,
      group: "accessory",
      category: accessoryConfigs[item.kind].plural,
      assetTag: item.assetTag,
      brand: item.brand,
      model: item.model,
      handler: item.handler,
      // RAM and chargers sit inside a laptop, so they count toward
      // that laptop's department.
      department:
        item.department ||
        (item.laptopId ? laptopDepartment.get(item.laptopId) : null) ||
        UNASSIGNED,
      status: item.status,
      purchaseDate: item.purchaseDate,
      year: item.purchaseDate.slice(0, 4),
      price: item.price ?? null,
      repairCost: null,
      repairDate: null,
      salePrice: null,
      saleDate: null,
    })),
  ];
}

function exportCsv(items: CostItem[]) {
  const header = [
    "Category",
    "Asset tag",
    "Brand",
    "Model",
    "Handler",
    "Department",
    "Status",
    "Purchase date",
    "Price (PHP)",
    "Repair cost (PHP)",
    "Repair date",
  ];
  const lines = items.map((item) =>
    [
      item.category,
      item.assetTag,
      item.brand,
      item.model,
      item.handler ?? "",
      item.department,
      item.status,
      item.purchaseDate,
      item.price ?? "",
      item.repairCost ?? "",
      item.repairDate ?? "",
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
  link.download = `asset-cost-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Horizontal bars of spend per label, largest first.
function SpendBars({
  rows,
  total,
}: {
  rows: { label: string; amount: number; count: number; group?: Group }[];
  total: number;
}) {
  const ready = useGrowIn();
  const max = Math.max(1, ...rows.map((row) => row.amount));
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No priced assets match the filters.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              {row.label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {row.count} {row.count === 1 ? "item" : "items"}
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {wholePeso(row.amount)}
              <span className="ml-1.5 text-muted-foreground">
                {total > 0 ? Math.round((row.amount / total) * 100) : 0}%
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                groupBarClass[row.group ?? "laptop"],
                growClass,
              )}
              style={{ width: ready ? `${(row.amount / max) * 100}%` : 0 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function groupSpend(
  items: CostItem[],
  key: (item: CostItem) => string,
  group?: (label: string) => Group,
) {
  const map = new Map<string, { amount: number; count: number }>();
  for (const item of items) {
    if (item.price == null) continue;
    const label = key(item);
    const entry = map.get(label) ?? { amount: 0, count: 0 };
    entry.amount += item.price;
    entry.count += 1;
    map.set(label, entry);
  }
  return [...map.entries()]
    .map(([label, entry]) => ({ label, ...entry, group: group?.(label) }))
    .sort((a, b) => b.amount - a.amount);
}

export function CostAnalyticsDashboard({
  laptops,
  accessories,
}: {
  laptops: Laptop[];
  accessories: Accessory[];
}) {
  const allItems = useMemo(
    () => toCostItems(laptops, accessories),
    [laptops, accessories],
  );

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<LaptopStatus[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);

  const categories = useMemo(() => {
    const kinds = Object.keys(accessoryConfigs) as AccessoryKind[];
    return [LAPTOPS, ...kinds.map((kind) => accessoryConfigs[kind].plural)];
  }, []);
  const departments = useMemo(
    () => [...new Set(allItems.map((item) => item.department))].sort(),
    [allItems],
  );
  const years = useMemo(
    () =>
      [
        ...new Set(
          allItems.flatMap((item) => [
            item.year,
            ...(item.repairDate ? [item.repairDate.slice(0, 4)] : []),
          ]),
        ),
      ]
        .sort()
        .reverse(),
    [allItems],
  );

  // Everything but the year filter, which purchases and repairs each apply
  // to their own date.
  const scoped = useMemo(
    () =>
      allItems.filter(
        (item) =>
          (categoryFilter.length === 0 ||
            categoryFilter.includes(item.category)) &&
          (statusFilter.length === 0 || statusFilter.includes(item.status)) &&
          (departmentFilter.length === 0 ||
            departmentFilter.includes(item.department)),
      ),
    [allItems, categoryFilter, statusFilter, departmentFilter],
  );
  const inYears = (date: string) =>
    yearFilter.length === 0 || yearFilter.includes(date.slice(0, 4));

  // Bought in the selected years.
  const items = scoped.filter((item) => inYears(item.purchaseDate));
  // Repaired in the selected years.
  const repaired = scoped
    .filter(
      (item): item is CostItem & { repairCost: number; repairDate: string } =>
        item.repairCost != null &&
        item.repairDate != null &&
        inYears(item.repairDate),
    )
    .sort((a, b) => b.repairCost - a.repairCost);

  const events: CostEvent[] = [
    ...priced(items).map((item) => ({
      group: item.group,
      date: item.purchaseDate,
      amount: item.price ?? 0,
    })),
    ...repaired.map((item) => ({
      group: "repair" as const,
      date: item.repairDate,
      amount: item.repairCost,
    })),
  ];

  const hasFilters =
    categoryFilter.length +
      statusFilter.length +
      departmentFilter.length +
      yearFilter.length >
    0;
  const clearFilters = () => {
    setCategoryFilter([]);
    setStatusFilter([]);
    setDepartmentFilter([]);
    setYearFilter([]);
  };

  const laptopItems = items.filter((item) => item.group === "laptop");
  const accessoryItems = items.filter((item) => item.group === "accessory");
  const pricedItems = priced(items);
  const pricedLaptops = priced(laptopItems);
  const pricedAccessories = priced(accessoryItems);
  const total = sum(items);
  const laptopTotal = sum(laptopItems);
  const accessoryTotal = sum(accessoryItems);
  const unpriced = items.length - pricedItems.length;
  const repairTotal = repaired.reduce((t, item) => t + item.repairCost, 0);
  const grandTotal = total + repairTotal;

  // Sold in the selected years.
  const sold = scoped.filter(
    (item): item is CostItem & { salePrice: number; saleDate: string } =>
      item.salePrice != null && item.saleDate != null && inYears(item.saleDate),
  );
  const proceeds = sold.reduce((t, item) => t + item.salePrice, 0);
  const soldCost = sold.reduce(
    (t, item) => t + (item.price ?? 0) + (item.repairCost ?? 0),
    0,
  );
  const netCost = grandTotal - proceeds;

  // Book value is computed in the browser, so it uses today's date.
  const today = useToday();
  const depreciation = (() => {
    const map = new Map<string, { cost: number; book: number; count: number }>();
    for (const item of items) {
      if (item.price == null || item.status === "Retired") continue;
      const entry = map.get(item.year) ?? { cost: 0, book: 0, count: 0 };
      entry.cost += item.price;
      entry.book += today ? bookValue(item, today) : 0;
      entry.count += 1;
      map.set(item.year, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, entry]) => ({ year, ...entry }));
  })();
  const inServiceCost = depreciation.reduce((t, row) => t + row.cost, 0);
  const bookTotal = depreciation.reduce((t, row) => t + row.book, 0);

  // A repair pays back the sale price if the laptop was then sold, or the
  // replacement it saved buying (its purchase price) if it was kept.
  const repairReturns = repaired.map((item) => {
    const returned = item.salePrice ?? item.price ?? 0;
    return {
      item,
      outcome: item.salePrice != null ? ("Sold" as const) : ("Kept" as const),
      returned,
      roi: ((returned - item.repairCost) / item.repairCost) * 100,
    };
  });
  const roiGroups = (["Sold", "Kept"] as const).map((outcome) => {
    const rows = repairReturns.filter((row) => row.outcome === outcome);
    const cost = rows.reduce((t, row) => t + row.item.repairCost, 0);
    const returned = rows.reduce((t, row) => t + row.returned, 0);
    return { outcome, units: rows.length, cost, returned };
  });
  const repairReturned = repairReturns.reduce((t, row) => t + row.returned, 0);
  const repairRoi = repairTotal
    ? ((repairReturned - repairTotal) / repairTotal) * 100
    : 0;
  const roiByItem = new Map(repairReturns.map((row) => [row.item.id, row]));

  const byCategory = [
    ...groupSpend(
      items,
      (item) => item.category,
      (label) => (label === LAPTOPS ? "laptop" : "accessory"),
    ),
    ...(repaired.length
      ? [
          {
            label: REPAIRS,
            amount: repairTotal,
            count: repaired.length,
            group: "repair" as const,
          },
        ]
      : []),
  ].sort((a, b) => b.amount - a.amount);
  const byDepartment = groupSpend(items, (item) => item.department);

  const eventDates = events.map((event) => event.date).sort();

  const byYear = (() => {
    const keys = [...new Set(eventDates.map((d) => d.slice(0, 4)))];
    const map = spendByPeriod(events, (d) => d.slice(0, 4), keys);
    return keys.map((year) => ({ key: year, label: year, ...map.get(year)! }));
  })();

  const byMonth = (() => {
    if (eventDates.length === 0) return [];
    const keys = monthRange(
      eventDates[0].slice(0, 7),
      eventDates[eventDates.length - 1].slice(0, 7),
    );
    const map = spendByPeriod(events, (d) => d.slice(0, 7), keys);
    return keys.map((month) => ({
      key: month,
      label: monthLabel(month),
      ...map.get(month)!,
    }));
  })();
  const activeMonths = byMonth.filter(
    (m) => m.laptop + m.accessory + m.repair > 0,
  );
  const busiestMonth = [...activeMonths].sort(
    (a, b) =>
      b.laptop + b.accessory + b.repair - (a.laptop + a.accessory + a.repair),
  )[0];

  const laptopModels = (() => {
    const map = new Map<string, number[]>();
    const unpricedByModel = new Map<string, number>();
    for (const item of laptopItems) {
      const key = `${item.brand} ${item.model}`.trim();
      if (item.price == null) {
        unpricedByModel.set(key, (unpricedByModel.get(key) ?? 0) + 1);
        continue;
      }
      map.set(key, [...(map.get(key) ?? []), item.price]);
    }
    const rows = [...map.entries()].map(([model, prices]) => ({
      model,
      units: prices.length,
      unpriced: unpricedByModel.get(model) ?? 0,
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      total: prices.reduce((a, b) => a + b, 0),
    }));
    return rows.sort((a, b) => b.total - a.total);
  })();

  const topAssets = [...pricedItems]
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 10);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Cost Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Purchase and repair cost of laptops and accessories ·{" "}
            {items.length} of {allItems.length} assets
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <FilterMenu
            label="Category"
            icon={BoxesIcon}
            options={categories}
            selected={categoryFilter}
            onChange={setCategoryFilter}
          />
          <FilterMenu
            label="Department"
            icon={BuildingIcon}
            options={departments}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <FilterMenu
            label="Year"
            icon={CalendarIcon}
            options={years}
            selected={yearFilter}
            onChange={setYearFilter}
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
          <Button
            onClick={() =>
              exportCsv([
                ...items,
                // Laptops repaired in range but bought outside it.
                ...repaired.filter((item) => !items.includes(item)),
              ])
            }
          >
            <DownloadIcon />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 md:col-span-2 lg:col-span-4 lg:grid-cols-4">
              <StatCard
                label="Total cost of ownership"
                value={
                  <span className={tone.cost}>
                    <AnimatedNumber value={grandTotal} format={wholePeso} />
                  </span>
                }
                footer={
                  <span
                    className={cn(
                      unpriced > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {unpriced > 0
                      ? `${unpriced} assets missing a price, not counted`
                      : `${wholePeso(total)} purchases · ${wholePeso(repairTotal)} repairs`}
                  </span>
                }
              />
              <StatCard
                label="Recovered from sales"
                value={
                  <span className={tone.gain}>
                    <AnimatedNumber value={proceeds} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    {sold.length
                      ? `${sold.length} sold · ${percent((proceeds / Math.max(1, soldCost)) * 100)} of what they cost`
                      : "No sales in range"}
                  </span>
                }
              />
              <StatCard
                label="Net cost"
                value={
                  <span className={tone.cost}>
                    <AnimatedNumber value={netCost} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    Total cost minus sale proceeds
                  </span>
                }
              />
              <StatCard
                label="Book value today"
                value={
                  <span className={tone.value}>
                    <AnimatedNumber value={bookTotal} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    {inServiceCost
                      ? `${percent((bookTotal / inServiceCost) * 100)} of ${wholePeso(inServiceCost)} · ${USEFUL_LIFE_YEARS}-yr straight-line`
                      : "No assets in service"}
                  </span>
                }
              />
              <StatCard
                label="Laptops"
                value={
                  <span className={tone.cost}>
                    <AnimatedNumber value={laptopTotal} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    Avg{" "}
                    {pricedLaptops.length
                      ? wholePeso(laptopTotal / pricedLaptops.length)
                      : "—"}{" "}
                    per laptop · {laptopItems.length} units
                  </span>
                }
              />
              <StatCard
                label="Accessories"
                value={
                  <span className={tone.cost}>
                    <AnimatedNumber value={accessoryTotal} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    Avg{" "}
                    {pricedAccessories.length
                      ? wholePeso(accessoryTotal / pricedAccessories.length)
                      : "—"}{" "}
                    per item · {accessoryItems.length} units
                  </span>
                }
              />
              <StatCard
                label="Repairs"
                value={
                  <span className={tone.cost}>
                    <AnimatedNumber value={repairTotal} format={wholePeso} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    {repaired.length
                      ? `${repaired.length} laptops · avg ${wholePeso(repairTotal / repaired.length)}`
                      : "No repairs in range"}
                  </span>
                }
              />
              <StatCard
                label="Repair ROI"
                value={
                  <span className={signedTone(repairRoi)}>
                    <AnimatedNumber value={repairRoi} format={percent} />
                  </span>
                }
                footer={
                  <span className="text-muted-foreground">
                    {repaired.length
                      ? `${wholePeso(repairReturned - repairTotal)} net gain on ${wholePeso(repairTotal)}`
                      : "No repairs in range"}
                  </span>
                }
              />
            </div>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Repair return on investment</CardTitle>
                <CardDescription>
                  Return is the sale price for laptops sold after repair, or
                  the replacement avoided (their purchase price) for laptops
                  kept in service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Scrollable>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-normal">Outcome</th>
                        <th className="pb-2 text-right font-normal">Units</th>
                        <th className="pb-2 text-right font-normal">
                          Repair cost
                        </th>
                        <th className="pb-2 text-right font-normal">Return</th>
                        <th className="pb-2 text-right font-normal">Net gain</th>
                        <th className="pb-2 text-right font-normal">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[
                        ...roiGroups.map((g) => ({
                          ...g,
                          label:
                            g.outcome === "Sold"
                              ? "Sold after repair"
                              : "Kept in service",
                        })),
                        {
                          outcome: "Total",
                          label: "Total",
                          units: repaired.length,
                          cost: repairTotal,
                          returned: repairReturned,
                        },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          className={cn(
                            "border-t border-border",
                            row.label === "Total" && "font-medium",
                          )}
                        >
                          <td className="py-2 pr-3 font-sans">{row.label}</td>
                          <td className="py-2 pl-3 text-right">{row.units}</td>
                          <td className={cn("py-2 pl-3 text-right", tone.cost)}>
                            {wholePeso(row.cost)}
                          </td>
                          <td className={cn("py-2 pl-3 text-right", tone.gain)}>
                            {wholePeso(row.returned)}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right",
                              signedTone(row.returned - row.cost),
                            )}
                          >
                            {wholePeso(row.returned - row.cost)}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right",
                              signedTone(row.returned - row.cost),
                            )}
                          >
                            {row.cost
                              ? percent(
                                  ((row.returned - row.cost) / row.cost) * 100,
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Scrollable>
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Depreciation</CardTitle>
                <CardDescription>
                  Assets still in service by purchase year,{" "}
                  {USEFUL_LIFE_YEARS}-year straight-line to zero
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Scrollable>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-normal">Bought</th>
                        <th className="pb-2 text-right font-normal">Items</th>
                        <th className="pb-2 text-right font-normal">Cost</th>
                        <th className="pb-2 text-right font-normal">
                          Depreciated
                        </th>
                        <th className="pb-2 text-right font-normal">
                          Book value
                        </th>
                        <th className="pb-2 text-right font-normal">Left</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {depreciation.map((row) => (
                        <tr key={row.year} className="border-t border-border">
                          <td className="py-2 pr-3 font-sans">{row.year}</td>
                          <td className="py-2 pl-3 text-right">{row.count}</td>
                          <td className={cn("py-2 pl-3 text-right", tone.cost)}>
                            {wholePeso(row.cost)}
                          </td>
                          <td className="py-2 pl-3 text-right text-muted-foreground">
                            {wholePeso(row.cost - row.book)}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right font-medium",
                              tone.value,
                            )}
                          >
                            {wholePeso(row.book)}
                          </td>
                          <td className="py-2 pl-3 text-right text-muted-foreground">
                            {row.cost ? percent((row.book / row.cost) * 100) : "—"}
                          </td>
                        </tr>
                      ))}
                      {depreciation.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center font-sans text-muted-foreground"
                          >
                            No assets in service match the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Scrollable>
              </CardContent>
            </BentoCard>

            <BentoCard className="md:col-span-2 lg:col-span-4">
              <CardHeader>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="grid gap-1.5">
                    <CardTitle className="text-base">Spend per month</CardTitle>
                    <CardDescription>
                      Purchases and repairs paid each month
                      {busiestMonth &&
                        ` · highest: ${monthLabel(busiestMonth.key, "long")} (${wholePeso(
                          busiestMonth.laptop +
                            busiestMonth.accessory +
                            busiestMonth.repair,
                        )})`}
                    </CardDescription>
                  </div>
                  <ChartLegend />
                </div>
              </CardHeader>
              <CardContent>
                {byMonth.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No costs match the filters.
                  </p>
                ) : (
                  <SpendChart
                    data={byMonth}
                    tooltipTitle={(key) => monthLabel(key, "long")}
                  />
                )}
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Spend by category</CardTitle>
                <CardDescription>
                  Total purchase cost per asset type, plus repairs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendBars rows={byCategory} total={grandTotal} />
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="grid gap-1.5">
                    <CardTitle className="text-base">Spend by year</CardTitle>
                    <CardDescription>
                      Purchases and repairs per year
                    </CardDescription>
                  </div>
                  <ChartLegend />
                </div>
              </CardHeader>
              <CardContent>
                {byYear.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No costs match the filters.
                  </p>
                ) : (
                  <SpendChart data={byYear} tooltipTitle={(key) => key} />
                )}
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Spend by department</CardTitle>
                <CardDescription>
                  Cost of assets each department currently holds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendBars rows={byDepartment} total={total} />
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Most expensive assets</CardTitle>
                <CardDescription>Top 10 by purchase price</CardDescription>
              </CardHeader>
              <CardContent>
                <Scrollable>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-normal">Asset</th>
                        <th className="pb-2 font-normal">Holder</th>
                        <th className="pb-2 font-normal">Status</th>
                        <th className="pb-2 text-right font-normal">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAssets.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{item.assetTag}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.brand} {item.model} · {item.category}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {item.handler ?? "—"}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  statusStyles[item.status].dot,
                                )}
                              />
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {wholePeso(item.price ?? 0)}
                          </td>
                        </tr>
                      ))}
                      {topAssets.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No priced assets match the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Scrollable>
              </CardContent>
            </BentoCard>

            <BentoCard className="md:col-span-2 lg:col-span-4">
              <CardHeader>
                <CardTitle className="text-base">Repair costs</CardTitle>
                <CardDescription>
                  {repaired.length
                    ? `${repaired.length} laptops repaired · ${wholePeso(repairTotal)} total`
                    : "Laptops with a repair cost recorded"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Scrollable className="max-h-96">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-normal">Laptop</th>
                        <th className="pb-2 font-normal">Status</th>
                        <th className="pb-2 font-normal">Repaired</th>
                        <th className="pb-2 text-right font-normal">
                          Purchase price
                        </th>
                        <th className="pb-2 text-right font-normal">
                          Repair cost
                        </th>
                        <th className="pb-2 text-right font-normal">
                          Of price
                        </th>
                        <th className="pb-2 text-right font-normal">Return</th>
                        <th className="pb-2 text-right font-normal">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repaired.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{item.assetTag}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.brand} {item.model}
                            </div>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  statusStyles[item.status].dot,
                                )}
                              />
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">
                            {item.repairDate}
                          </td>
                          <td className="py-2 pl-3 text-right font-mono tabular-nums text-muted-foreground">
                            {item.price != null ? wholePeso(item.price) : "—"}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right font-mono font-medium tabular-nums",
                              tone.cost,
                            )}
                          >
                            {wholePeso(item.repairCost)}
                          </td>
                          <td className="py-2 pl-3 text-right font-mono tabular-nums text-muted-foreground">
                            {item.price
                              ? `${Math.round((item.repairCost / item.price) * 100)}%`
                              : "—"}
                          </td>
                          <td className="py-2 pl-3 text-right whitespace-nowrap">
                            <div className={cn("font-mono tabular-nums", tone.gain)}>
                              {wholePeso(roiByItem.get(item.id)?.returned ?? 0)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.salePrice != null
                                ? "Sold"
                                : "Replacement avoided"}
                            </div>
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right font-mono font-medium tabular-nums",
                              signedTone(roiByItem.get(item.id)?.roi ?? 0),
                            )}
                          >
                            {percent(roiByItem.get(item.id)?.roi ?? 0)}
                          </td>
                        </tr>
                      ))}
                      {repaired.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No repairs match the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Scrollable>
              </CardContent>
            </BentoCard>

            <BentoCard className="md:col-span-2 lg:col-span-4">
              <CardHeader>
                <CardTitle className="text-base">Laptop prices by model</CardTitle>
                <CardDescription>
                  What each model cost across all units bought
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Scrollable>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-normal">Model</th>
                        <th className="pb-2 text-right font-normal">Units</th>
                        <th className="pb-2 text-right font-normal">Average</th>
                        <th className="pb-2 text-right font-normal">Lowest</th>
                        <th className="pb-2 text-right font-normal">Highest</th>
                        <th className="pb-2 text-right font-normal">Total</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {laptopModels.map((row) => (
                        <tr key={row.model} className="border-t border-border">
                          <td className="py-2 pr-3 font-sans font-medium">
                            {row.model}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {row.units}
                            {row.unpriced > 0 && (
                              <span className="ml-1 font-sans text-xs text-muted-foreground">
                                +{row.unpriced} unpriced
                              </span>
                            )}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {wholePeso(row.avg)}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {wholePeso(row.min)}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {wholePeso(row.max)}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-3 text-right font-medium",
                              tone.cost,
                            )}
                          >
                            {wholePeso(row.total)}
                          </td>
                        </tr>
                      ))}
                      {laptopModels.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center font-sans text-muted-foreground"
                          >
                            No priced laptops match the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Scrollable>
              </CardContent>
            </BentoCard>
          </div>
        </div>
    </div>
  );
}
