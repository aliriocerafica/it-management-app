// An inclusive span of calendar days, each as a local YYYY-MM-DD string.
export type DateRange = { from: string; to: string };

export function toIsoDay(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function fromIsoDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

// Whether a stored date falls inside the range. Takes either a plain
// YYYY-MM-DD day or a full timestamp, which is read in local time. With no
// range everything passes; with one, a missing date doesn't.
export function inDateRange(
  value: string | null | undefined,
  range: DateRange | null,
) {
  if (!range) return true;
  if (!value) return false;
  const day = value.length > 10 ? toIsoDay(new Date(value)) : value;
  return day >= range.from && day <= range.to;
}

// Whether anything happened inside the range, given every date on which
// something did.
export function anyInDateRange(
  values: (string | null | undefined)[],
  range: DateRange | null,
) {
  if (!range) return true;
  return values.some((value) => value && inDateRange(value, range));
}
