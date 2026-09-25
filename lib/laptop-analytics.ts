import { parseDate, type Laptop } from "@/lib/laptops";

// Laptops are due for replacement once they reach this age.
export const REFRESH_YEARS = 4;

export type Grade = "A" | "B" | "C" | "D" | "F";

export const grades: Grade[] = ["A", "B", "C", "D", "F"];

export const gradeInfo: Record<
  Grade,
  { label: string; min: number; action: string }
> = {
  A: { label: "Brand new", min: 80, action: "Keep in service" },
  B: { label: "Good", min: 65, action: "Keep in service" },
  C: { label: "Fair", min: 50, action: "Monitor, plan budget" },
  D: { label: "Poor", min: 35, action: "Replace in 6 months" },
  F: { label: "End of life", min: 0, action: "Replace now" },
};

// Diverging scale: blue = healthy, gray = neutral, red = needs replacing.
// Validated for colour-blind separation on both light and dark surfaces.
export const gradeColorClass: Record<Grade, string> = {
  A: "bg-[#1c5cab] dark:bg-[#256abf]",
  B: "bg-[#5598e7] dark:bg-[#6da7ec]",
  C: "bg-[#bdbcb6] dark:bg-[#75746f]",
  D: "bg-[#e08a3a] dark:bg-[#d9923b]",
  F: "bg-[#c23434] dark:bg-[#d94040]",
};

// The same colours as raw values, for charts that take a colour prop.
export const gradeHex: Record<Grade, { light: string; dark: string }> = {
  A: { light: "#1c5cab", dark: "#256abf" },
  B: { light: "#5598e7", dark: "#6da7ec" },
  C: { light: "#bdbcb6", dark: "#75746f" },
  D: { light: "#e08a3a", dark: "#d9923b" },
  F: { light: "#c23434", dark: "#d94040" },
};

export type GradedLaptop = {
  laptop: Laptop;
  ageYears: number;
  usageYears: number;
  // Share of the laptop's life it has spent assigned to a person.
  utilization: number;
  score: number;
  grade: Grade;
  refreshDate: Date;
};

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

function years(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / YEAR);
}

// Time the laptop has spent with a handler up to `asOf`, summed across its
// ownership history. Open stints are assumed to continue, so a future
// `asOf` projects today's assignments forward. Laptops with no recorded
// history count from the purchase date if they are currently assigned.
export function usageYears(laptop: Laptop, asOf: Date) {
  if (laptop.history.length === 0) {
    return laptop.handler ? years(parseDate(laptop.purchaseDate), asOf) : 0;
  }
  return laptop.history
    .filter((entry) => entry.handler !== null)
    .reduce((sum, entry) => {
      const to = entry.to ? parseDate(entry.to) : asOf;
      return sum + years(parseDate(entry.from), to < asOf ? to : asOf);
    }, 0);
}

// A retired laptop's final history entry is its stint back with IT.
function retiredSince(laptop: Laptop) {
  if (laptop.status !== "Retired") return null;
  const last = laptop.history.at(-1);
  return last && last.handler === null ? parseDate(last.from) : null;
}

// Health score out of 100. Age wears a laptop down by 10 points a year and
// time in someone's hands by a further 6 points a year, so a heavily used
// laptop grades lower than an idle one of the same age.
//
// Grading at another date (`current: false`) uses the history up to that
// date and skips the penalties that only describe the laptop right now.
export function gradeLaptop(
  laptop: Laptop,
  asOf: Date,
  { current = true } = {},
): GradedLaptop {
  const purchased = parseDate(laptop.purchaseDate);
  const ageYears = years(purchased, asOf);
  const used = Math.min(usageYears(laptop, asOf), ageYears);
  const utilization = ageYears > 0 ? used / ageYears : 0;

  let score = 100 - ageYears * 10 - used * 6;
  if (current && laptop.status === "In repair") score -= 10;
  if (current && laptop.charger.condition === "Missing") score -= 5;
  score = Math.round(Math.max(0, Math.min(100, score)));
  const retired = retiredSince(laptop);
  if (current ? laptop.status === "Retired" : retired && asOf >= retired) {
    score = 0;
  }

  const grade = grades.find((g) => score >= gradeInfo[g].min) ?? "F";

  const refreshDate = new Date(purchased);
  refreshDate.setFullYear(refreshDate.getFullYear() + REFRESH_YEARS);

  return {
    laptop,
    ageYears,
    usageYears: used,
    utilization,
    score,
    grade,
    refreshDate,
  };
}

export function isRetiredAt(laptop: Laptop, date: Date) {
  const since = retiredSince(laptop);
  return since !== null && date >= since;
}

export type TrendPoint = {
  date: Date;
  projected: boolean;
  counts: Record<Grade, number>;
};

// How many laptops sat in each grade, one point a month from `monthsBack`
// ago to `monthsAhead` from now. Laptops count once they were purchased.
export function gradeTrend(
  laptops: Laptop[],
  today: Date,
  monthsBack = 24,
  monthsAhead = 12,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let offset = -monthsBack; offset <= monthsAhead; offset++) {
    const date = new Date(today);
    date.setMonth(date.getMonth() + offset);
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const laptop of laptops) {
      if (parseDate(laptop.purchaseDate) > date) continue;
      counts[gradeLaptop(laptop, date, { current: offset === 0 }).grade]++;
    }
    points.push({ date, projected: offset > 0, counts });
  }
  return points;
}

export function formatYears(value: number) {
  return `${value.toFixed(1)} yr`;
}

export function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, v) => sum + v, 0) / values.length;
}
