export type LaptopStatus = "In use" | "Vacant" | "In repair" | "Retired";

export type ChargerCondition = "Good" | "Worn cable" | "Replaced" | "Missing";

export type Charger = {
  connector: string;
  wattage: number;
  partNumber: string;
  serialNumber: string;
  condition: ChargerCondition;
};

export type Laptop = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  serialNumber: string;
  cpu: string;
  ram: string;
  storage: string;
  os: string;
  color: string;
  colorHex: string;
  handler: string | null;
  department: string | null;
  purchaseDate: string;
  warrantyYears: number;
  status: LaptopStatus;
  // What's wrong and still needs fixing. Set while "In repair", and kept
  // when the laptop goes back into use before the repair is complete
  // (shown as "Pending repair").
  repairIssue?: string | null;
  anydeskAddress?: string | null;
  charger: Charger;
  history: OwnershipEntry[];
};

// One stint with a laptop, oldest first. A null handler means the laptop
// was back with IT (storage, re-imaging, awaiting disposal). The last entry
// has `to: null` and describes where the laptop is now.
export type OwnershipEntry = {
  handler: string | null;
  department?: string;
  from: string;
  to: string | null;
  note?: string;
};

// Fleet audit of 29 Sep 2026. The audit didn't record serial numbers, exact
// purchase dates, OS, colour or charger details, so those are placeholders
// (serials are PENDING-###) to be corrected as each unit is checked.
const AUDIT_DATE = "2026-09-29";

type AuditedLaptop = {
  brand: string;
  model: string;
  cpu: string;
  ram: string;
  storage: string;
  ageYears: number;
  status: LaptopStatus;
  findings: string;
  // Problem and planned fix, for units sent to repair.
  repair?: string;
  wattage?: number;
};

const auditedLaptops: AuditedLaptop[] = [
  { brand: "Acer", model: "Aspire 3 A315-59-598K", cpu: "Intel Core i5-1235U", ram: "8 GB", storage: "512 GB SSD", ageYears: 1, status: "In repair", findings: "Won't power on, battery", repair: "Won't power on; battery worn. Diagnose power board / motherboard. Still under warranty, so raise an Acer claim before paying for repair" },
  { brand: "Acer", model: "Aspire 3 A315-44P-R9LQ", cpu: "AMD Ryzen 7 5700U", ram: "16 GB", storage: "512 GB SSD", ageYears: 1, status: "Vacant", findings: "Battery wear only" },
  { brand: "Lenovo", model: "IdeaPad Slim 5 16IAH8", cpu: "Intel Core i5-13500H", ram: "8 GB", storage: "512 GB SSD", ageYears: 1, status: "Vacant", findings: "No issues" },
  { brand: "Lenovo", model: "IdeaPad Gaming 3 15ACH6", cpu: "AMD Ryzen 5 5500H · RTX 2050", ram: "8 GB", storage: "512 GB SSD", ageYears: 2, status: "Vacant", findings: "Battery wear only", wattage: 135 },
  { brand: "Lenovo", model: "IdeaPad Slim 3 15IAH8", cpu: "Intel Core i5-13420H", ram: "8 GB", storage: "512 GB SSD", ageYears: 2, status: "In repair", findings: "Keyboard, casing damage, battery", repair: "Keyboard faulty, casing damaged, battery worn. Replace keyboard / top cover and battery. Still under warranty, check with Lenovo first" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Slow performance, casing damage, battery", repair: "Slow, casing damaged, battery worn. Upgrade RAM to 16 GB, clean-install Windows, replace battery; check casing" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Trackpad, slow performance, battery", repair: "Trackpad faulty, slow, battery worn. Replace trackpad, upgrade RAM to 16 GB, clean-install Windows, replace battery" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Slow performance, casing damage, battery", repair: "Slow, casing damaged, battery worn. Upgrade RAM to 16 GB, clean-install Windows, replace battery; check casing" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Slow performance, casing damage, battery", repair: "Slow, casing damaged, battery worn. Upgrade RAM to 16 GB, clean-install Windows, replace battery; check casing" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Retired", findings: "Overheating / fan, keyboard, slow performance, casing damage, battery" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Slow performance, battery", repair: "Slow, battery worn. Upgrade RAM to 16 GB, clean-install Windows, replace battery" },
  { brand: "Lenovo", model: "IdeaPad 3 14ITL05", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Slow performance, battery", repair: "Slow, battery worn. Upgrade RAM to 16 GB, clean-install Windows, replace battery" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Vacant", findings: "Cosmetic casing damage, battery wear" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "In repair", findings: "Keyboard, casing damage, battery", repair: "Keyboard faulty, casing damaged, battery worn. Replace keyboard / top cover and battery" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Retired", findings: "Won't power on, casing damage, battery" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Retired", findings: "Hinge, keyboard, casing damage, battery" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Vacant", findings: "Cosmetic casing damage, battery wear" },
  { brand: "Lenovo", model: "IdeaPad 3 15ITL6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 4, status: "Vacant", findings: "Battery wear only" },
  { brand: "Acer", model: "Aspire 3 A315-58-55A6", cpu: "Intel Core i5-1135G7", ram: "8 GB", storage: "512 GB SSD", ageYears: 5, status: "Retired", findings: "Keyboard, casing damage, battery" },
  { brand: "Acer", model: "Aspire 3 A314-22", cpu: "AMD Ryzen 5 3500U", ram: "8 GB", storage: "256 GB SSD", ageYears: 5, status: "Retired", findings: "Missing parts, slow performance, casing damage, battery" },
];

const auditOutcome: Record<LaptopStatus, string> = {
  "In use": "Assigned",
  Vacant: "Ready to issue",
  "In repair": "Sent to repair",
  Retired: "Retired",
};

function yearsBefore(isoDate: string, years: number) {
  const [year, month, day] = isoDate.split("-");
  return `${Number(year) - years}-${month}-${day}`;
}

export const initialLaptops: Laptop[] = auditedLaptops.map((unit, index) => {
  const n = String(index + 1).padStart(3, "0");
  const purchaseDate = yearsBefore(AUDIT_DATE, unit.ageYears);
  return {
    id: String(index + 1),
    assetTag: `AR-LT-AU26-${n}`,
    brand: unit.brand,
    model: unit.model,
    serialNumber: `PENDING-${n}`,
    cpu: unit.cpu,
    ram: unit.ram,
    storage: unit.storage,
    os: "Windows 11",
    color: "Grey",
    colorHex: "#8a8d91",
    handler: null,
    department: null,
    purchaseDate,
    warrantyYears: 3,
    status: unit.status,
    repairIssue: unit.status === "In repair" ? (unit.repair ?? unit.findings) : null,
    charger: {
      connector: "USB-C",
      wattage: unit.wattage ?? 65,
      partNumber: "",
      serialNumber: "",
      condition: "Good",
    },
    history: [
      { handler: null, from: purchaseDate, to: AUDIT_DATE, note: "Received by IT" },
      {
        handler: null,
        from: AUDIT_DATE,
        to: null,
        note: `Audit ${AUDIT_DATE} · ${auditOutcome[unit.status]}: ${unit.findings}`,
      },
    ],
  };
});

export const statuses: LaptopStatus[] = [
  "In use",
  "Vacant",
  "In repair",
  "Retired",
];

export const statusStyles: Record<LaptopStatus, { dot: string; text: string }> =
  {
    "In use": {
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    Vacant: { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
    "In repair": {
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    },
    Retired: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  };

export function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthsBetween(from: Date, to: Date) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatAge(purchaseDate: string, today: Date) {
  return formatSpan(parseDate(purchaseDate), today);
}

export function formatSpan(from: Date, to: Date) {
  const months = monthsBetween(from, to);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return rest === 0 ? "< 1 mo" : `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

export function warrantyInfo(
  laptop: Pick<Laptop, "purchaseDate" | "warrantyYears">,
  today: Date,
) {
  const end = parseDate(laptop.purchaseDate);
  end.setFullYear(end.getFullYear() + laptop.warrantyYears);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  const state =
    daysLeft < 0 ? "Expired" : daysLeft <= 90 ? "Expiring" : "Active";
  return { end, state } as const;
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// The fields the shared assign / repair dialogs need from any tracked item.
export type TrackedItem = Pick<
  Laptop,
  "brand" | "model" | "assetTag" | "handler"
>;

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
