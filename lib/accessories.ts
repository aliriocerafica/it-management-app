import { employees } from "@/lib/employees";
import { type LaptopStatus, type OwnershipEntry } from "@/lib/laptops";

export type AccessoryKind = "headset" | "mouse" | "monitor" | "bag";

export type Accessory = {
  id: string;
  kind: AccessoryKind;
  assetTag: string;
  brand: string;
  model: string;
  serialNumber: string;
  color: string;
  colorHex: string;
  handler: string | null;
  department: string | null;
  purchaseDate: string;
  warrantyYears: number;
  status: LaptopStatus;
  // Kind-specific details, keyed by the kind's spec field keys.
  specs: Record<string, string>;
  history: OwnershipEntry[];
};

export type SpecField = {
  key: string;
  label: string;
  placeholder?: string;
  // A fixed list renders as a select; otherwise a free-text input.
  options?: string[];
};

export type AccessoryConfig = {
  kind: AccessoryKind;
  singular: string;
  plural: string;
  tagPrefix: string;
  modelPlaceholder: string;
  brandPlaceholder: string;
  specFields: SpecField[];
  // One-line summary for the table's Specs column.
  summary: (specs: Record<string, string>) => {
    primary: string;
    secondary: string;
  };
};

export const accessoryConfigs: Record<AccessoryKind, AccessoryConfig> = {
  headset: {
    kind: "headset",
    singular: "Headset",
    plural: "Headsets",
    tagPrefix: "HS",
    brandPlaceholder: "e.g. Jabra",
    modelPlaceholder: "e.g. Evolve2 65",
    specFields: [
      {
        key: "type",
        label: "Type",
        options: ["Over-ear", "On-ear", "In-ear"],
      },
      {
        key: "connection",
        label: "Connection",
        options: ["USB-A", "USB-C", "Bluetooth", "Wireless dongle", "3.5 mm"],
      },
      {
        key: "microphone",
        label: "Microphone",
        options: ["Boom", "Built-in", "None"],
      },
      {
        key: "noiseCancelling",
        label: "Noise cancelling",
        options: ["Yes", "No"],
      },
    ],
    summary: (s) => ({
      primary: `${s.type} · ${s.connection}`,
      secondary: `${s.microphone} mic · ANC ${s.noiseCancelling?.toLowerCase()}`,
    }),
  },
  mouse: {
    kind: "mouse",
    singular: "Mouse",
    plural: "Mice",
    tagPrefix: "MS",
    brandPlaceholder: "e.g. Logitech",
    modelPlaceholder: "e.g. MX Master 3S",
    specFields: [
      {
        key: "type",
        label: "Type",
        options: ["Standard", "Ergonomic", "Vertical", "Trackball", "Compact"],
      },
      {
        key: "connection",
        label: "Connection",
        options: ["USB receiver", "Bluetooth", "Wired USB"],
      },
      {
        key: "power",
        label: "Power",
        options: ["Rechargeable", "AA battery", "AAA battery", "Wired"],
      },
      {
        key: "hand",
        label: "Hand",
        options: ["Right", "Left", "Ambidextrous"],
      },
    ],
    summary: (s) => ({
      primary: `${s.type} · ${s.connection}`,
      secondary: `${s.power} · ${s.hand}-handed`.replace(
        "Ambidextrous-handed",
        "Ambidextrous",
      ),
    }),
  },
  monitor: {
    kind: "monitor",
    singular: "Monitor",
    plural: "Monitors",
    tagPrefix: "MN",
    brandPlaceholder: "e.g. Dell",
    modelPlaceholder: "e.g. UltraSharp U2723QE",
    specFields: [
      { key: "size", label: "Size", placeholder: 'e.g. 27"' },
      {
        key: "resolution",
        label: "Resolution",
        options: [
          "1920 × 1080",
          "2560 × 1440",
          "3440 × 1440",
          "3840 × 2160",
          "5120 × 2880",
        ],
      },
      {
        key: "panel",
        label: "Panel",
        options: ["IPS", "VA", "OLED", "TN"],
      },
      { key: "ports", label: "Ports", placeholder: "e.g. HDMI, DP, USB-C" },
    ],
    summary: (s) => ({
      primary: `${s.size} · ${s.resolution}`,
      secondary: `${s.panel} · ${s.ports}`,
    }),
  },
  bag: {
    kind: "bag",
    singular: "Laptop bag",
    plural: "Laptop bags",
    tagPrefix: "BG",
    brandPlaceholder: "e.g. Targus",
    modelPlaceholder: "e.g. Cypress EcoSmart",
    specFields: [
      {
        key: "type",
        label: "Type",
        options: ["Backpack", "Messenger", "Sleeve", "Briefcase", "Tote"],
      },
      {
        key: "fits",
        label: "Fits laptops up to",
        options: ['13"', '14"', '15.6"', '16"', '17"'],
      },
      { key: "material", label: "Material", placeholder: "e.g. Recycled PET" },
    ],
    summary: (s) => ({
      primary: `${s.type} · up to ${s.fits}`,
      secondary: s.material,
    }),
  },
};

// -- Seed data ---------------------------------------------------------------

type Stint = [handler: string, from: string, to?: string, note?: string];

type Seed = Omit<
  Accessory,
  "id" | "kind" | "assetTag" | "handler" | "department" | "history"
> & {
  owners: Stint[];
  // Note on the final "with IT" stint when the item isn't with anyone.
  itNote?: string;
};

function departmentOf(name: string) {
  return employees.find((e) => e.name === name)?.department;
}

// Turns a list of owner stints into a full history, filling the gaps
// before, between and after owners with time back at IT.
function buildHistory(seed: Seed): OwnershipEntry[] {
  const history: OwnershipEntry[] = [];
  let cursor = seed.purchaseDate;
  seed.owners.forEach(([handler, from, to, note], index) => {
    if (from > cursor) {
      history.push({
        handler: null,
        from: cursor,
        to: from,
        note: index === 0 ? "Received by IT" : "Checked and restocked",
      });
    }
    history.push({
      handler,
      department: departmentOf(handler),
      from,
      to: to ?? null,
      note,
    });
    cursor = to ?? from;
  });
  const last = history.at(-1);
  if (!last || last.to !== null) {
    history.push({
      handler: null,
      from: cursor,
      to: null,
      note: seed.itNote ?? "Ready to assign",
    });
  }
  return history;
}

function build(kind: AccessoryKind, seeds: Seed[]): Accessory[] {
  const { tagPrefix } = accessoryConfigs[kind];
  return seeds.map(({ owners, itNote, ...seed }, index) => {
    const history = buildHistory({ ...seed, owners, itNote });
    const current = history.at(-1);
    const handler = current?.handler ?? null;
    return {
      ...seed,
      id: `${kind}-${index + 1}`,
      kind,
      assetTag: `${tagPrefix}-${String(index + 1).padStart(4, "0")}`,
      handler,
      department: handler ? (departmentOf(handler) ?? null) : null,
      history,
    };
  });
}

const headsets = build("headset", [
  {
    brand: "Jabra",
    model: "Evolve2 65",
    serialNumber: "JB65-4471A",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2024-06-24",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "On-ear",
      connection: "Wireless dongle",
      microphone: "Boom",
      noiseCancelling: "Yes",
    },
    owners: [["Liam Smith", "2024-07-01"]],
  },
  {
    brand: "Poly",
    model: "Voyager Focus 2",
    serialNumber: "PV2-88213",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-03-15",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "On-ear",
      connection: "Bluetooth",
      microphone: "Boom",
      noiseCancelling: "Yes",
    },
    owners: [
      ["Ethan Brooks", "2023-03-20", "2024-08-30", "Left the company"],
      ["Noah Anderson", "2024-09-09"],
    ],
  },
  {
    brand: "Sony",
    model: "WH-1000XM5",
    serialNumber: "SNY-5M0921",
    color: "Silver",
    colorHex: "#c9c9c9",
    purchaseDate: "2023-11-02",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "Over-ear",
      connection: "Bluetooth",
      microphone: "Built-in",
      noiseCancelling: "Yes",
    },
    owners: [["Isabella Garcia", "2023-11-20"]],
  },
  {
    brand: "Logitech",
    model: "Zone Wired",
    serialNumber: "LZW-30117",
    color: "Graphite",
    colorHex: "#3a3a3c",
    purchaseDate: "2022-05-10",
    warrantyYears: 2,
    status: "In repair",
    specs: {
      type: "On-ear",
      connection: "USB-C",
      microphone: "Boom",
      noiseCancelling: "Yes",
    },
    owners: [
      [
        "Daniel Foster",
        "2022-05-16",
        undefined,
        "Mic crackling, sent for repair",
      ],
    ],
  },
  {
    brand: "Jabra",
    model: "Evolve2 40 SE",
    serialNumber: "JB40-99021",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2024-02-14",
    warrantyYears: 2,
    status: "Vacant",
    specs: {
      type: "On-ear",
      connection: "USB-A",
      microphone: "Boom",
      noiseCancelling: "No",
    },
    owners: [["Lily Chen", "2024-02-20", "2025-10-03", "Upgraded headset"]],
  },
  {
    brand: "Apple",
    model: "AirPods Pro (2nd gen)",
    serialNumber: "APP2-H7Q1",
    color: "White",
    colorHex: "#f5f5f5",
    purchaseDate: "2024-10-17",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "In-ear",
      connection: "Bluetooth",
      microphone: "Built-in",
      noiseCancelling: "Yes",
    },
    owners: [["Lucas Young", "2024-10-21"]],
  },
  {
    brand: "EPOS",
    model: "Impact 860T",
    serialNumber: "EP860-1120",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2021-09-01",
    warrantyYears: 2,
    status: "Retired",
    specs: {
      type: "On-ear",
      connection: "USB-A",
      microphone: "Boom",
      noiseCancelling: "Yes",
    },
    owners: [["Chloe Ramirez", "2021-09-06", "2025-06-12", "Headband cracked"]],
    itNote: "Retired, awaiting disposal",
  },
  {
    brand: "Logitech",
    model: "Zone Vibe 100",
    serialNumber: "LZV-77310",
    color: "Rose",
    colorHex: "#e8b4b8",
    purchaseDate: "2025-01-20",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "Over-ear",
      connection: "Bluetooth",
      microphone: "Built-in",
      noiseCancelling: "No",
    },
    owners: [["Amelia Davis", "2025-01-27"]],
  },
  {
    brand: "Jabra",
    model: "Evolve2 65",
    serialNumber: "JB65-5530B",
    color: "Beige",
    colorHex: "#d8cbb5",
    purchaseDate: "2025-03-11",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "On-ear",
      connection: "Wireless dongle",
      microphone: "Boom",
      noiseCancelling: "Yes",
    },
    owners: [["Zoe Bennett", "2025-03-17"]],
  },
  {
    brand: "Poly",
    model: "Blackwire 5220",
    serialNumber: "PB52-60482",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-07-21",
    warrantyYears: 2,
    status: "Vacant",
    specs: {
      type: "On-ear",
      connection: "USB-C",
      microphone: "Boom",
      noiseCancelling: "No",
    },
    owners: [],
  },
]);

const mice = build("mouse", [
  {
    brand: "Logitech",
    model: "MX Master 3S",
    serialNumber: "LMX3S-22019",
    color: "Graphite",
    colorHex: "#3a3a3c",
    purchaseDate: "2024-06-24",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "Ergonomic",
      connection: "Bluetooth",
      power: "Rechargeable",
      hand: "Right",
    },
    owners: [["Liam Smith", "2024-07-01"]],
  },
  {
    brand: "Apple",
    model: "Magic Mouse",
    serialNumber: "AMM-K2P91",
    color: "White",
    colorHex: "#f5f5f5",
    purchaseDate: "2023-03-15",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "Standard",
      connection: "Bluetooth",
      power: "Rechargeable",
      hand: "Ambidextrous",
    },
    owners: [["Noah Anderson", "2024-09-09"]],
  },
  {
    brand: "Logitech",
    model: "Lift Vertical",
    serialNumber: "LLV-40418",
    color: "Rose",
    colorHex: "#e8b4b8",
    purchaseDate: "2023-08-08",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "Vertical",
      connection: "USB receiver",
      power: "AA battery",
      hand: "Left",
    },
    owners: [["Emma Johnson", "2023-08-14"]],
  },
  {
    brand: "Microsoft",
    model: "Bluetooth Mouse",
    serialNumber: "MSB-10021",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2022-11-04",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "Compact",
      connection: "Bluetooth",
      power: "AAA battery",
      hand: "Ambidextrous",
    },
    owners: [["Olivia Brown", "2022-11-10"]],
  },
  {
    brand: "Logitech",
    model: "M720 Triathlon",
    serialNumber: "LM720-9981",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2022-08-12",
    warrantyYears: 1,
    status: "In repair",
    specs: {
      type: "Standard",
      connection: "USB receiver",
      power: "AA battery",
      hand: "Right",
    },
    owners: [["Mia Miller", "2022-08-20", undefined, "Scroll wheel sticking"]],
  },
  {
    brand: "Dell",
    model: "MS116 Optical",
    serialNumber: "DMS116-7730",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2021-02-18",
    warrantyYears: 1,
    status: "Retired",
    specs: {
      type: "Standard",
      connection: "Wired USB",
      power: "Wired",
      hand: "Ambidextrous",
    },
    owners: [["Ryan Cooper", "2021-02-22", "2024-12-02", "Cable frayed"]],
    itNote: "Retired, awaiting disposal",
  },
  {
    brand: "Logitech",
    model: "MX Anywhere 3S",
    serialNumber: "LMXA3-5520",
    color: "Pale Gray",
    colorHex: "#d9d9d6",
    purchaseDate: "2025-01-20",
    warrantyYears: 2,
    status: "In use",
    specs: {
      type: "Compact",
      connection: "Bluetooth",
      power: "Rechargeable",
      hand: "Ambidextrous",
    },
    owners: [["Amelia Davis", "2025-01-27"]],
  },
  {
    brand: "Kensington",
    model: "Expert Mouse",
    serialNumber: "KEM-66102",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2024-02-14",
    warrantyYears: 5,
    status: "Vacant",
    specs: {
      type: "Trackball",
      connection: "USB receiver",
      power: "AA battery",
      hand: "Ambidextrous",
    },
    owners: [["Sophia Jones", "2024-02-20", "2026-07-31", "Returned"]],
  },
  {
    brand: "Logitech",
    model: "Signal M650",
    serialNumber: "LM650-3014",
    color: "Off-white",
    colorHex: "#ecebe6",
    purchaseDate: "2025-03-11",
    warrantyYears: 1,
    status: "Vacant",
    specs: {
      type: "Standard",
      connection: "USB receiver",
      power: "AA battery",
      hand: "Right",
    },
    owners: [],
  },
  {
    brand: "Microsoft",
    model: "Sculpt Ergonomic",
    serialNumber: "MSE-80711",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-12-30",
    warrantyYears: 1,
    status: "In use",
    specs: {
      type: "Ergonomic",
      connection: "USB receiver",
      power: "AA battery",
      hand: "Right",
    },
    owners: [["Ava Williams", "2024-01-05"]],
  },
]);

const monitors = build("monitor", [
  {
    brand: "Dell",
    model: "UltraSharp U2723QE",
    serialNumber: "CN0DU27Q-81",
    color: "Silver",
    colorHex: "#c9c9c9",
    purchaseDate: "2024-06-24",
    warrantyYears: 3,
    status: "In use",
    specs: {
      size: '27"',
      resolution: "3840 × 2160",
      panel: "IPS",
      ports: "HDMI, DP, USB-C 90 W",
    },
    owners: [["Liam Smith", "2024-07-01"]],
  },
  {
    brand: "LG",
    model: "27UP850N",
    serialNumber: "LG27UP-4410",
    color: "White",
    colorHex: "#f5f5f5",
    purchaseDate: "2023-03-15",
    warrantyYears: 3,
    status: "In use",
    specs: {
      size: '27"',
      resolution: "3840 × 2160",
      panel: "IPS",
      ports: "HDMI, DP, USB-C 96 W",
    },
    owners: [
      ["Chloe Ramirez", "2023-03-20", "2024-08-30", "Moved desks"],
      ["Noah Anderson", "2024-09-09"],
    ],
  },
  {
    brand: "Samsung",
    model: 'Odyssey G5 34"',
    serialNumber: "SMG5-34K19",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2022-04-10",
    warrantyYears: 3,
    status: "In use",
    specs: {
      size: '34"',
      resolution: "3440 × 1440",
      panel: "VA",
      ports: "HDMI, DP",
    },
    owners: [["Isabella Garcia", "2022-04-12"]],
  },
  {
    brand: "Dell",
    model: "P2422H",
    serialNumber: "CN0P24-2290",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2021-11-16",
    warrantyYears: 3,
    status: "In use",
    specs: {
      size: '24"',
      resolution: "1920 × 1080",
      panel: "IPS",
      ports: "HDMI, DP, VGA",
    },
    owners: [["Emma Johnson", "2021-11-22"]],
  },
  {
    brand: "HP",
    model: "E24 G5",
    serialNumber: "HPE24-66120",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2022-11-04",
    warrantyYears: 3,
    status: "In repair",
    specs: {
      size: '24"',
      resolution: "1920 × 1080",
      panel: "IPS",
      ports: "HDMI, DP, USB-A",
    },
    owners: [
      ["Olivia Brown", "2022-11-10", undefined, "Dead pixels, under warranty"],
    ],
  },
  {
    brand: "Apple",
    model: "Studio Display",
    serialNumber: "ASD-C02F1K",
    color: "Silver",
    colorHex: "#c9c9c9",
    purchaseDate: "2024-07-27",
    warrantyYears: 1,
    status: "In use",
    specs: {
      size: '27"',
      resolution: "5120 × 2880",
      panel: "IPS",
      ports: "Thunderbolt 3, USB-C",
    },
    owners: [["Harper Martinez", "2024-08-01"]],
  },
  {
    brand: "Dell",
    model: "P2419H",
    serialNumber: "CN0P19-0038",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2020-08-12",
    warrantyYears: 3,
    status: "Retired",
    specs: {
      size: '24"',
      resolution: "1920 × 1080",
      panel: "IPS",
      ports: "HDMI, DP, VGA",
    },
    owners: [
      ["Daniel Foster", "2020-08-17", "2025-09-15", "Backlight failing"],
    ],
    itNote: "Retired, awaiting disposal",
  },
  {
    brand: "LG",
    model: "24MP400",
    serialNumber: "LG24MP-8871",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-09-02",
    warrantyYears: 2,
    status: "Vacant",
    specs: {
      size: '24"',
      resolution: "1920 × 1080",
      panel: "IPS",
      ports: "HDMI, VGA",
    },
    owners: [["Ethan Brooks", "2023-09-08", "2025-11-14", "Left the company"]],
  },
  {
    brand: "BenQ",
    model: "PD2705U",
    serialNumber: "BQPD27-1045",
    color: "Gray",
    colorHex: "#8a8d91",
    purchaseDate: "2025-01-20",
    warrantyYears: 3,
    status: "In use",
    specs: {
      size: '27"',
      resolution: "3840 × 2160",
      panel: "IPS",
      ports: "HDMI, DP, USB-C 65 W",
    },
    owners: [["Amelia Davis", "2025-01-27"]],
  },
  {
    brand: "Dell",
    model: "UltraSharp U2424H",
    serialNumber: "CN0U24-5561",
    color: "Silver",
    colorHex: "#c9c9c9",
    purchaseDate: "2025-03-11",
    warrantyYears: 3,
    status: "Vacant",
    specs: {
      size: '24"',
      resolution: "1920 × 1080",
      panel: "IPS",
      ports: "HDMI, DP, USB-A",
    },
    owners: [],
  },
]);

const bags = build("bag", [
  {
    brand: "Targus",
    model: "Cypress EcoSmart",
    serialNumber: "TG-CE-1182",
    color: "Gray",
    colorHex: "#8a8d91",
    purchaseDate: "2024-06-24",
    warrantyYears: 1,
    status: "In use",
    specs: { type: "Backpack", fits: '15.6"', material: "Recycled PET" },
    owners: [["Liam Smith", "2024-07-01"]],
  },
  {
    brand: "Incase",
    model: "Icon Sleeve",
    serialNumber: "IC-IS-2201",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-03-15",
    warrantyYears: 1,
    status: "In use",
    specs: { type: "Sleeve", fits: '14"', material: "Woolenex" },
    owners: [["Noah Anderson", "2024-09-09"]],
  },
  {
    brand: "Samsonite",
    model: "Pro-DLX 6",
    serialNumber: "SM-PD6-5530",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2022-04-10",
    warrantyYears: 10,
    status: "In use",
    specs: { type: "Briefcase", fits: '15.6"', material: "Ballistic nylon" },
    owners: [["William Clark", "2022-04-14"]],
  },
  {
    brand: "Targus",
    model: "Classic Messenger",
    serialNumber: "TG-CM-0931",
    color: "Navy",
    colorHex: "#1f2a44",
    purchaseDate: "2021-11-16",
    warrantyYears: 1,
    status: "Retired",
    specs: { type: "Messenger", fits: '16"', material: "Polyester" },
    owners: [["James Hall", "2021-11-22", "2025-04-08", "Zip broken"]],
    itNote: "Retired, awaiting disposal",
  },
  {
    brand: "Thule",
    model: "Subterra 2 21L",
    serialNumber: "TH-S2-7713",
    color: "Dark Slate",
    colorHex: "#3e4a4f",
    purchaseDate: "2024-10-17",
    warrantyYears: 25,
    status: "In use",
    specs: { type: "Backpack", fits: '16"', material: "Nylon" },
    owners: [["Lucas Young", "2024-10-21"]],
  },
  {
    brand: "Dell",
    model: "EcoLoop Pro",
    serialNumber: "DL-ELP-4420",
    color: "Black",
    colorHex: "#1f1f1f",
    purchaseDate: "2023-07-21",
    warrantyYears: 3,
    status: "Vacant",
    specs: { type: "Backpack", fits: '15.6"', material: "Recycled PET" },
    owners: [["Benjamin Lewis", "2023-07-25", "2026-02-10", "Returned"]],
  },
  {
    brand: "Incase",
    model: "Compass Brief",
    serialNumber: "IC-CB-6120",
    color: "Heather Gray",
    colorHex: "#9b9b9b",
    purchaseDate: "2022-08-12",
    warrantyYears: 1,
    status: "In repair",
    specs: { type: "Briefcase", fits: '14"', material: "Polyester" },
    owners: [["Mia Miller", "2022-08-20", undefined, "Strap clip replacement"]],
  },
  {
    brand: "Targus",
    model: "Newport Tote",
    serialNumber: "TG-NT-3308",
    color: "Olive",
    colorHex: "#6b6b3a",
    purchaseDate: "2025-03-11",
    warrantyYears: 1,
    status: "Vacant",
    specs: { type: "Tote", fits: '15.6"', material: "Canvas" },
    owners: [],
  },
]);

export const initialAccessories: Record<AccessoryKind, Accessory[]> = {
  headset: headsets,
  mouse: mice,
  monitor: monitors,
  bag: bags,
};
