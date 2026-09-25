import { useSyncExternalStore } from "react";

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

const laptopRecords: Omit<Laptop, "history">[] = [
  {
    id: "1",
    assetTag: "LT-0001",
    brand: "Apple",
    model: 'MacBook Pro 14" M3',
    serialNumber: "C02XK1Y7MD6T",
    cpu: "Apple M3 Pro",
    ram: "18 GB",
    storage: "512 GB SSD",
    os: "macOS 15",
    color: "Space Black",
    colorHex: "#2b2b2d",
    handler: "Liam Smith",
    department: "Management",
    purchaseDate: "2024-06-24",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "MagSafe 3 (USB-C)",
      wattage: 70,
      partNumber: "MKU63AM/A",
      serialNumber: "C4H3291A0Q7",
      condition: "Good",
    },
  },
  {
    id: "2",
    assetTag: "LT-0002",
    brand: "Dell",
    model: "Latitude 7440",
    serialNumber: "8H2KJ93",
    cpu: "Intel Core i7-1365U",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Pro",
    color: "Titan Gray",
    colorHex: "#6b6e73",
    handler: "Noah Anderson",
    department: "Design",
    purchaseDate: "2023-03-15",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "DELL-0M0H25",
      serialNumber: "CN-0M0H25-4H2K1",
      condition: "Good",
    },
  },
  {
    id: "3",
    assetTag: "LT-0003",
    brand: "Lenovo",
    model: "ThinkPad X1 Carbon Gen 11",
    serialNumber: "PF3ZK8QW",
    cpu: "Intel Core i7-1355U",
    ram: "32 GB",
    storage: "1 TB SSD",
    os: "Windows 11 Pro",
    color: "Deep Black",
    colorHex: "#111111",
    handler: "Isabella Garcia",
    department: "Engineering",
    purchaseDate: "2022-04-10",
    warrantyYears: 3,
    status: "In repair",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "Lenovo 4X20V24678",
      serialNumber: "8SSA10R16871",
      condition: "Missing",
    },
  },
  {
    id: "4",
    assetTag: "LT-0004",
    brand: "HP",
    model: "EliteBook 840 G10",
    serialNumber: "5CG3291LQX",
    cpu: "Intel Core i5-1345U",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Pro",
    color: "Silver",
    colorHex: "#c9cbce",
    handler: "William Clark",
    department: "Product",
    purchaseDate: "2023-02-28",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "HP 4P0H5AA",
      serialNumber: "WHFAD0CJ9K5L",
      condition: "Good",
    },
  },
  {
    id: "5",
    assetTag: "LT-0005",
    brand: "Apple",
    model: 'MacBook Air 13" M2',
    serialNumber: "FVFHK2Q1Q6L4",
    cpu: "Apple M2",
    ram: "8 GB",
    storage: "256 GB SSD",
    os: "macOS 15",
    color: "Midnight",
    colorHex: "#2e3642",
    handler: "James Hall",
    department: "Operations",
    purchaseDate: "2024-05-19",
    warrantyYears: 1,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 35,
      partNumber: "Apple MNWP3AM/A",
      serialNumber: "C4H2471MQ2D",
      condition: "Good",
    },
  },
  {
    id: "6",
    assetTag: "LT-0006",
    brand: "Lenovo",
    model: "ThinkPad T14 Gen 4",
    serialNumber: "PF4B7M2X",
    cpu: "AMD Ryzen 7 PRO 7840U",
    ram: "32 GB",
    storage: "1 TB SSD",
    os: "Windows 11 Pro",
    color: "Thunder Black",
    colorHex: "#1c1c1e",
    handler: "Benjamin Lewis",
    department: "Data",
    purchaseDate: "2024-01-03",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "Lenovo 4X20V24678",
      serialNumber: "8SSA10R19302",
      condition: "Good",
    },
  },
  {
    id: "7",
    assetTag: "LT-0007",
    brand: "Dell",
    model: "XPS 13 Plus",
    serialNumber: "3JX8L12",
    cpu: "Intel Core i7-1360P",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Home",
    color: "Platinum",
    colorHex: "#dcdcdc",
    handler: null,
    department: null,
    purchaseDate: "2023-07-21",
    warrantyYears: 1,
    status: "Vacant",
    charger: {
      connector: "USB-C",
      wattage: 60,
      partNumber: "DELL-0XCPCV",
      serialNumber: "CN-0XCPCV-3JX81",
      condition: "Good",
    },
  },
  {
    id: "8",
    assetTag: "LT-0008",
    brand: "Apple",
    model: 'MacBook Pro 16" M1 Pro',
    serialNumber: "C02G81KXMD6R",
    cpu: "Apple M1 Pro",
    ram: "16 GB",
    storage: "1 TB SSD",
    os: "macOS 14",
    color: "Silver",
    colorHex: "#c9cbce",
    handler: "Emma Johnson",
    department: "Design",
    purchaseDate: "2021-11-16",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "MagSafe 3 (USB-C)",
      wattage: 140,
      partNumber: "Apple MLYU3AM/A",
      serialNumber: "C4H1461JD6R",
      condition: "Worn cable",
    },
  },
  {
    id: "9",
    assetTag: "LT-0009",
    brand: "HP",
    model: "ProBook 450 G9",
    serialNumber: "5CD2140KTR",
    cpu: "Intel Core i5-1235U",
    ram: "8 GB",
    storage: "256 GB SSD",
    os: "Windows 11 Pro",
    color: "Pike Silver",
    colorHex: "#a9adb2",
    handler: "Olivia Brown",
    department: "Marketing",
    purchaseDate: "2022-11-04",
    warrantyYears: 1,
    status: "In use",
    charger: {
      connector: "Barrel 4.5 mm",
      wattage: 45,
      partNumber: "HP 741727-001",
      serialNumber: "WDBZN0CJ2PL8",
      condition: "Replaced",
    },
  },
  {
    id: "10",
    assetTag: "LT-0010",
    brand: "Microsoft",
    model: "Surface Laptop 5",
    serialNumber: "0F3K7T22AB",
    cpu: "Intel Core i7-1265U",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Pro",
    color: "Sage",
    colorHex: "#9fae9b",
    handler: "Ava Williams",
    department: "Engineering",
    purchaseDate: "2023-12-30",
    warrantyYears: 2,
    status: "In use",
    charger: {
      connector: "Surface Connect",
      wattage: 65,
      partNumber: "Microsoft 1706",
      serialNumber: "0F3K7T22AB-PSU",
      condition: "Good",
    },
  },
  {
    id: "11",
    assetTag: "LT-0011",
    brand: "Lenovo",
    model: "ThinkPad E14 Gen 5",
    serialNumber: "PF4DQ1LZ",
    cpu: "Intel Core i5-1335U",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Pro",
    color: "Graphite Black",
    colorHex: "#232323",
    handler: "Sophia Jones",
    department: "Engineering",
    purchaseDate: "2023-06-05",
    warrantyYears: 1,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "Lenovo 4X20V24678",
      serialNumber: "8SSA10R22015",
      condition: "Good",
    },
  },
  {
    id: "12",
    assetTag: "LT-0012",
    brand: "Dell",
    model: "Latitude 5420",
    serialNumber: "9KD2M83",
    cpu: "Intel Core i5-1145G7",
    ram: "8 GB",
    storage: "256 GB SSD",
    os: "Windows 10 Pro",
    color: "Black",
    colorHex: "#1a1a1a",
    handler: null,
    department: null,
    purchaseDate: "2020-08-12",
    warrantyYears: 3,
    status: "Retired",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "DELL-0M0H25",
      serialNumber: "CN-0M0H25-9KD2M",
      condition: "Good",
    },
  },
  {
    id: "13",
    assetTag: "LT-0013",
    brand: "Apple",
    model: 'MacBook Air 15" M3',
    serialNumber: "H7WQ2LK9P1",
    cpu: "Apple M3",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "macOS 15",
    color: "Starlight",
    colorHex: "#e6ddd0",
    handler: "Lucas Young",
    department: "Engineering",
    purchaseDate: "2024-10-17",
    warrantyYears: 1,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 35,
      partNumber: "Apple MNWP3AM/A",
      serialNumber: "C4H2481L0P1",
      condition: "Good",
    },
  },
  {
    id: "14",
    assetTag: "LT-0014",
    brand: "ASUS",
    model: "ExpertBook B9",
    serialNumber: "N9NXCV01H2",
    cpu: "Intel Core i7-1355U",
    ram: "16 GB",
    storage: "1 TB SSD",
    os: "Windows 11 Pro",
    color: "Star Black",
    colorHex: "#15171c",
    handler: "Alexander Wright",
    department: "IT",
    purchaseDate: "2023-02-08",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "ASUS A21-065N1A",
      serialNumber: "N9CHG01H2A",
      condition: "Good",
    },
  },
  {
    id: "15",
    assetTag: "LT-0015",
    brand: "HP",
    model: "ZBook Firefly 14 G10",
    serialNumber: "5CG40211PM",
    cpu: "AMD Ryzen 7 PRO 7840HS",
    ram: "32 GB",
    storage: "1 TB SSD",
    os: "Windows 11 Pro",
    color: "Silver",
    colorHex: "#c9cbce",
    handler: "Harper Martinez",
    department: "IT",
    purchaseDate: "2024-07-27",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "HP 4P0H5AA",
      serialNumber: "WHFAD0CK1PM3",
      condition: "Good",
    },
  },
  {
    id: "16",
    assetTag: "LT-0016",
    brand: "Lenovo",
    model: "IdeaPad Slim 5",
    serialNumber: "PF3R1Q7C",
    cpu: "AMD Ryzen 5 7530U",
    ram: "16 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Home",
    color: "Cloud Grey",
    colorHex: "#b8babd",
    handler: null,
    department: null,
    purchaseDate: "2024-02-14",
    warrantyYears: 1,
    status: "Vacant",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "Lenovo 5A11K06377",
      serialNumber: "8SSA11K3R1Q7",
      condition: "Good",
    },
  },
  {
    id: "17",
    assetTag: "LT-0017",
    brand: "Dell",
    model: "Vostro 3520",
    serialNumber: "4LX9P22",
    cpu: "Intel Core i5-1235U",
    ram: "8 GB",
    storage: "512 GB SSD",
    os: "Windows 11 Pro",
    color: "Carbon Black",
    colorHex: "#202124",
    handler: "Mia Miller",
    department: "Security",
    purchaseDate: "2022-08-12",
    warrantyYears: 1,
    status: "In repair",
    charger: {
      connector: "Barrel 4.5 mm",
      wattage: 65,
      partNumber: "DELL-0G4X7T",
      serialNumber: "CN-0G4X7T-4LX9P",
      condition: "Missing",
    },
  },
  {
    id: "18",
    assetTag: "LT-0018",
    brand: "Apple",
    model: 'MacBook Pro 14" M4 Pro',
    serialNumber: "K4TQ9XR2W7",
    cpu: "Apple M4 Pro",
    ram: "24 GB",
    storage: "1 TB SSD",
    os: "macOS 15",
    color: "Space Black",
    colorHex: "#2b2b2d",
    handler: "Amelia Davis",
    department: "Design",
    purchaseDate: "2025-01-20",
    warrantyYears: 3,
    status: "In use",
    charger: {
      connector: "MagSafe 3 (USB-C)",
      wattage: 96,
      partNumber: "Apple MX0J2AM/A",
      serialNumber: "C4H4521R2W7",
      condition: "Good",
    },
  },
  {
    id: "19",
    assetTag: "LT-0019",
    brand: "Microsoft",
    model: "Surface Pro 9",
    serialNumber: "0F1P6S88CD",
    cpu: "Intel Core i5-1235U",
    ram: "8 GB",
    storage: "256 GB SSD",
    os: "Windows 11 Pro",
    color: "Platinum",
    colorHex: "#dcdcdc",
    handler: null,
    department: null,
    purchaseDate: "2023-09-02",
    warrantyYears: 1,
    status: "Vacant",
    charger: {
      connector: "Surface Connect",
      wattage: 65,
      partNumber: "Microsoft 1800",
      serialNumber: "0F1P6S88CD-PSU",
      condition: "Good",
    },
  },
  {
    id: "20",
    assetTag: "LT-0020",
    brand: "ASUS",
    model: "Zenbook 14 OLED",
    serialNumber: "R3NXCV77K1",
    cpu: "Intel Core Ultra 7 155H",
    ram: "16 GB",
    storage: "1 TB SSD",
    os: "Windows 11 Home",
    color: "Ponder Blue",
    colorHex: "#2f3b55",
    handler: "Charlotte Reed",
    department: "Marketing",
    purchaseDate: "2025-03-11",
    warrantyYears: 2,
    status: "In use",
    charger: {
      connector: "USB-C",
      wattage: 65,
      partNumber: "ASUS A20-065N1A",
      serialNumber: "R3CHG77K1B",
      condition: "Good",
    },
  },
];

const ownershipHistory: Record<string, OwnershipEntry[]> = {
  "1": [
    {
      handler: null,
      from: "2024-06-24",
      to: "2024-07-01",
      note: "Received and imaged by IT",
    },
    {
      handler: "Liam Smith",
      department: "Management",
      from: "2024-07-01",
      to: null,
    },
  ],
  "2": [
    {
      handler: "Chloe Turner",
      department: "Design",
      from: "2023-03-20",
      to: "2024-08-30",
      note: "Left the company",
    },
    {
      handler: null,
      from: "2024-08-30",
      to: "2024-09-09",
      note: "Wiped and re-imaged",
    },
    {
      handler: "Noah Anderson",
      department: "Design",
      from: "2024-09-09",
      to: null,
    },
  ],
  "3": [
    {
      handler: "Daniel Kim",
      department: "Engineering",
      from: "2022-04-12",
      to: "2023-11-15",
      note: "Upgraded to a workstation",
    },
    {
      handler: "Isabella Garcia",
      department: "Engineering",
      from: "2023-11-20",
      to: null,
      note: "Keyboard replacement in progress",
    },
  ],
  "4": [
    {
      handler: "William Clark",
      department: "Product",
      from: "2023-03-02",
      to: null,
    },
  ],
  "5": [
    {
      handler: "Grace Lee",
      department: "Operations",
      from: "2024-05-20",
      to: "2025-02-14",
      note: "Moved to a MacBook Pro",
    },
    {
      handler: "James Hall",
      department: "Operations",
      from: "2025-02-17",
      to: null,
    },
  ],
  "6": [
    {
      handler: "Benjamin Lewis",
      department: "Data",
      from: "2024-01-05",
      to: null,
    },
  ],
  "7": [
    {
      handler: "Ethan Park",
      department: "Sales",
      from: "2023-07-24",
      to: "2024-06-28",
      note: "Transferred to another office",
    },
    {
      handler: "Sofia Rossi",
      department: "Sales",
      from: "2024-07-01",
      to: "2026-08-29",
      note: "Left the company",
    },
    {
      handler: null,
      from: "2026-08-29",
      to: null,
      note: "Wiped, ready to assign",
    },
  ],
  "8": [
    {
      handler: "Marcus Hill",
      department: "Engineering",
      from: "2021-11-18",
      to: "2023-05-31",
    },
    {
      handler: "Priya Shah",
      department: "Design",
      from: "2023-06-05",
      to: "2024-12-20",
      note: "Parental leave",
    },
    {
      handler: "Emma Johnson",
      department: "Design",
      from: "2025-01-06",
      to: null,
    },
  ],
  "9": [
    {
      handler: "Olivia Brown",
      department: "Marketing",
      from: "2022-11-07",
      to: null,
      note: "Charger replaced Mar 2024",
    },
  ],
  "10": [
    {
      handler: "Ava Williams",
      department: "Engineering",
      from: "2024-01-02",
      to: null,
    },
  ],
  "11": [
    {
      handler: "Liam Chen",
      department: "Engineering",
      from: "2023-06-07",
      to: "2024-10-11",
      note: "Left the company",
    },
    {
      handler: "Sophia Jones",
      department: "Engineering",
      from: "2024-10-14",
      to: null,
    },
  ],
  "12": [
    {
      handler: "Oliver Grant",
      department: "Finance",
      from: "2020-08-14",
      to: "2022-09-30",
    },
    {
      handler: "Hannah Cole",
      department: "Finance",
      from: "2022-10-03",
      to: "2025-06-27",
      note: "Battery failure",
    },
    {
      handler: null,
      from: "2025-06-27",
      to: null,
      note: "Retired, awaiting disposal",
    },
  ],
  "13": [
    {
      handler: "Lucas Young",
      department: "Engineering",
      from: "2024-10-18",
      to: null,
    },
  ],
  "14": [
    {
      handler: "Nina Patel",
      department: "IT",
      from: "2023-02-10",
      to: "2024-04-19",
      note: "Moved to a ZBook",
    },
    {
      handler: "Alexander Wright",
      department: "IT",
      from: "2024-04-22",
      to: null,
    },
  ],
  "15": [
    {
      handler: "Harper Martinez",
      department: "IT",
      from: "2024-07-29",
      to: null,
    },
  ],
  "16": [
    {
      handler: "Jacob Reed",
      department: "Support",
      from: "2024-02-19",
      to: "2026-07-31",
      note: "Returned laptop",
    },
    { handler: null, from: "2026-07-31", to: null, note: "Ready to assign" },
  ],
  "17": [
    {
      handler: "Tom Baker",
      department: "Security",
      from: "2022-08-15",
      to: "2023-12-01",
      note: "Left the company",
    },
    {
      handler: "Mia Miller",
      department: "Security",
      from: "2023-12-04",
      to: null,
      note: "At repair center for a screen replacement",
    },
  ],
  "18": [
    {
      handler: "Amelia Davis",
      department: "Design",
      from: "2025-01-22",
      to: null,
    },
  ],
  "19": [
    {
      handler: "Leo Martins",
      department: "Sales",
      from: "2023-09-05",
      to: "2025-11-14",
      note: "Left the company",
    },
    { handler: null, from: "2025-11-14", to: null, note: "Ready to assign" },
  ],
  "20": [
    {
      handler: "Charlotte Reed",
      department: "Marketing",
      from: "2025-03-12",
      to: null,
    },
  ],
};

export const initialLaptops: Laptop[] = laptopRecords.map((laptop) => ({
  ...laptop,
  history: ownershipHistory[laptop.id] ?? [],
}));

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

// Ages are computed in the browser so they always reflect today's date,
// rather than the date the page was prerendered.
const noopSubscribe = () => () => {};
export function useToday() {
  const key = useSyncExternalStore(
    noopSubscribe,
    () => new Date().toDateString(),
    () => null,
  );
  return key ? new Date(key) : null;
}

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
