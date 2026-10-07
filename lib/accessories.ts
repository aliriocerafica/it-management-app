import { employees } from "@/lib/employees";
import { type LaptopStatus, type OwnershipEntry } from "@/lib/laptops";

export type AccessoryKind =
  | "headset"
  | "mouse"
  | "monitor"
  | "bag"
  | "battery"
  | "keyboard"
  | "ram";

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
  // Fault still waiting to be fixed, as for laptops.
  repairIssue?: string | null;
  // RAM only: the laptop it's installed in (instead of a handler).
  laptopId?: string | null;
  history: OwnershipEntry[];
};

// A type name for use mid-sentence: lowercased, except acronyms such as
// "RAM", so "RAM modules" stays as is and "Laptop Bags" becomes "laptop bags".
export function lowerNoun(name: string) {
  return name
    .split(" ")
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(" ");
}

// Warranty length for display; 0 years means the item has no warranty.
export function formatWarranty(years: number) {
  if (years === 0) return "No warranty";
  return `${years} year${years === 1 ? "" : "s"}`;
}

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
  // Installed in a laptop (adding to its memory) rather than assigned to a
  // person. Only RAM so far.
  installsInLaptop?: boolean;
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
        options: [
          "USB-A",
          "USB-C",
          "USB-A + USB-C",
          "Bluetooth",
          "Wireless dongle",
          "3.5 mm",
        ],
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
  battery: {
    kind: "battery",
    singular: "Battery",
    plural: "Batteries",
    tagPrefix: "BT",
    brandPlaceholder: "e.g. Ace",
    modelPlaceholder: "e.g. AA",
    specFields: [
      {
        key: "size",
        label: "Size",
        options: ["AA", "AAA", "C", "D", "9V", "CR2032"],
      },
      {
        key: "chemistry",
        label: "Chemistry",
        options: ["Alkaline", "Rechargeable NiMH", "Lithium", "Carbon-zinc"],
      },
    ],
    summary: (s) => ({
      primary: s.size,
      secondary: s.chemistry,
    }),
  },
  keyboard: {
    kind: "keyboard",
    singular: "Keyboard",
    plural: "Keyboards",
    tagPrefix: "KB",
    brandPlaceholder: "e.g. Logitech",
    modelPlaceholder: "e.g. K120",
    specFields: [
      {
        key: "type",
        label: "Type",
        options: ["Full-size", "Tenkeyless", "Compact", "Ergonomic"],
      },
      {
        key: "connection",
        label: "Connection",
        options: ["Wired USB", "USB receiver", "Bluetooth"],
      },
      {
        key: "switches",
        label: "Switches",
        options: ["Membrane", "Mechanical", "Scissor"],
      },
      { key: "layout", label: "Layout", placeholder: "e.g. US English" },
    ],
    summary: (s) => ({
      primary: `${s.type} · ${s.connection}`,
      secondary: `${s.switches} · ${s.layout}`,
    }),
  },
  ram: {
    kind: "ram",
    singular: "RAM module",
    plural: "RAM modules",
    tagPrefix: "RAM",
    installsInLaptop: true,
    brandPlaceholder: "e.g. Kingston",
    modelPlaceholder: "e.g. KVR32S22S8/8",
    specFields: [
      {
        key: "capacity",
        label: "Capacity",
        options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB"],
      },
      {
        key: "type",
        label: "Type",
        options: ["DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4X", "LPDDR5"],
      },
      {
        key: "formFactor",
        label: "Form factor",
        options: ["SO-DIMM (laptop)", "DIMM (desktop)"],
      },
      { key: "speed", label: "Speed", placeholder: "e.g. 3200 MHz" },
    ],
    summary: (s) => ({
      primary: `${s.capacity} ${s.type}`,
      secondary: `${s.formFactor} · ${s.speed}`,
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

const headsets = build("headset", []);
const mice = build("mouse", []);
const monitors = build("monitor", []);
const bags = build("bag", []);
const batteries = build("battery", []);
const keyboards = build("keyboard", []);
const ram = build("ram", []);

export const initialAccessories: Record<AccessoryKind, Accessory[]> = {
  headset: headsets,
  mouse: mice,
  monitor: monitors,
  bag: bags,
  battery: batteries,
  keyboard: keyboards,
  ram,
};
