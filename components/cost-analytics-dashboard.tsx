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
  statusStyles,
  statuses,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { cn } from "@/lib/utils";

const UNASSIGNED = "Unassigned / stock";
const LAPTOPS = "Laptops";

type Group = "laptop" | "accessory";

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
};

const chartConfig = {
  laptop: {
    label: "Laptops",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  accessory: {
    label: "Accessories",
    theme: { light: "#d98a1c", dark: "#e9a23b" },
  },
} satisfies ChartConfig;

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
    ...laptops.map<CostItem>((laptop) => ({
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
    })),
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
                row.group === "accessory"
                  ? "bg-[#d98a1c] dark:bg-[#e9a23b]"
                  : "bg-[#2a78d6] dark:bg-[#3987e5]",
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
    () => [...new Set(allItems.map((item) => item.year))].sort().reverse(),
    [allItems],
  );

  const items = useMemo(
    () =>
      allItems.filter(
        (item) =>
          (categoryFilter.length === 0 ||
            categoryFilter.includes(item.category)) &&
          (statusFilter.length === 0 || statusFilter.includes(item.status)) &&
          (departmentFilter.length === 0 ||
            departmentFilter.includes(item.department)) &&
          (yearFilter.length === 0 || yearFilter.includes(item.year)),
      ),
    [allItems, categoryFilter, statusFilter, departmentFilter, yearFilter],
  );

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
  const activeItems = items.filter((item) => item.status !== "Retired");
  const activeTotal = sum(activeItems);
  const retiredTotal = total - activeTotal;
  const unpriced = items.length - pricedItems.length;

  const byCategory = groupSpend(
    items,
    (item) => item.category,
    (label) => (label === LAPTOPS ? "laptop" : "accessory"),
  );
  const byDepartment = groupSpend(items, (item) => item.department);

  const byYear = (() => {
    const map = new Map<string, { laptop: number; accessory: number }>();
    for (const item of items) {
      if (item.price == null) continue;
      const entry = map.get(item.year) ?? { laptop: 0, accessory: 0 };
      entry[item.group] += item.price;
      map.set(item.year, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, entry]) => ({ year, ...entry }));
  })();

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
            Acquisition cost of laptops and accessories · {items.length} of{" "}
            {allItems.length} assets
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
          <Button onClick={() => exportCsv(items)}>
            <DownloadIcon />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 md:col-span-2 lg:col-span-4 xl:grid-cols-5">
              <StatCard
                className="sm:col-span-2 xl:col-span-1"
                label="Total asset spend"
                value={<AnimatedNumber value={total} format={wholePeso} />}
                footer={
                  <span className="text-muted-foreground">
                    {pricedItems.length} of {items.length} assets priced
                  </span>
                }
              />
              <StatCard
                label="Laptops"
                value={<AnimatedNumber value={laptopTotal} format={wholePeso} />}
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
                  <AnimatedNumber value={accessoryTotal} format={wholePeso} />
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
                label="Active asset value"
                value={<AnimatedNumber value={activeTotal} format={wholePeso} />}
                footer={
                  <span className="text-muted-foreground">
                    {wholePeso(retiredTotal)} in retired assets
                  </span>
                }
              />
              <StatCard
                label="Missing a price"
                value={<AnimatedNumber value={unpriced} />}
                footer={
                  <span
                    className={cn(
                      unpriced > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {unpriced > 0
                      ? "Not counted in totals · add prices in inventory"
                      : "Every asset has a price"}
                  </span>
                }
              />
            </div>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Spend by category</CardTitle>
                <CardDescription>
                  Total purchase cost per asset type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendBars rows={byCategory} total={total} />
              </CardContent>
            </BentoCard>

            <BentoCard className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Spend by year</CardTitle>
                <CardDescription>
                  Purchases per year, laptops vs. accessories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {byYear.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No priced assets match the filters.
                  </p>
                ) : (
                  <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-64 w-full"
                  >
                    <BarChart
                      data={byYear}
                      margin={{ left: 4, right: 8, top: 8 }}
                    >
                      <CartesianGrid
                        className="stroke-border"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="year"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
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
                          const row = payload?.[0]?.payload as
                            | (typeof byYear)[number]
                            | undefined;
                          if (!active || !row) return null;
                          return (
                            <TooltipBox>
                              <div className="font-medium">{row.year}</div>
                              <TooltipRow
                                color="var(--color-laptop)"
                                label="Laptops"
                                value={wholePeso(row.laptop)}
                              />
                              <TooltipRow
                                color="var(--color-accessory)"
                                label="Accessories"
                                value={wholePeso(row.accessory)}
                              />
                              <TooltipRow
                                label="Total"
                                value={wholePeso(row.laptop + row.accessory)}
                              />
                            </TooltipBox>
                          );
                        }}
                      />
                      <Bar
                        dataKey="laptop"
                        stackId="spend"
                        fill="var(--color-laptop)"
                        animationDuration={900}
                      />
                      <Bar
                        dataKey="accessory"
                        stackId="spend"
                        fill="var(--color-accessory)"
                        radius={[4, 4, 0, 0]}
                        animationDuration={900}
                      />
                    </BarChart>
                  </ChartContainer>
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
                          <td className="py-2 pl-3 text-right font-medium">
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
