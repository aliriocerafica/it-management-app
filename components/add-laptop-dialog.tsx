"use client";

import { useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  statuses,
  type ChargerCondition,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { cn } from "@/lib/utils";

const chargerConditions: ChargerCondition[] = [
  "Good",
  "Worn cable",
  "Replaced",
  "Missing",
];

const connectors = [
  "USB-C",
  "MagSafe 3 (USB-C)",
  "Surface Connect",
  "Barrel 4.5 mm",
  "Barrel 7.4 mm",
];

export const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextAssetTag(laptops: Laptop[]) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `AR-LT-AU${yy}-`;
  const max = laptops.reduce((highest, l) => {
    if (!l.assetTag.startsWith(prefix)) return highest;
    const n = Number(l.assetTag.slice(prefix.length));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function FormField({
  label,
  htmlFor,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">(optional)</span>
        ) : (
          <span className="font-normal text-muted-foreground" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{children}</div>
    </fieldset>
  );
}

// Without `laptop` this is the "Add" dialog with its own trigger button. With
// `laptop` it edits that laptop's details and is opened by the parent.
// Status, handler and history are left alone: those change through the
// assign / return / repair actions.
export function AddLaptopDialog({
  laptops,
  onAdd,
  laptop,
  open: openProp,
  onOpenChange,
  onSave,
}: {
  laptops: Laptop[];
  onAdd?: (laptop: Laptop) => void;
  laptop?: Laptop | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (laptop: Laptop) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [error, setError] = useState<string | null>(null);
  const [colorHex, setColorHex] = useState(laptop?.colorHex ?? "#2b2b2d");

  const editing = laptop != null;
  const formId = editing ? "edit-laptop-form" : "add-laptop-form";
  const brands = [...new Set(laptops.map((l) => l.brand))].sort();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? "").trim();

    const assetTag = get("assetTag").toUpperCase();
    const status = get("status") as LaptopStatus;
    const handler = get("handler");
    const department = get("department");
    const purchaseDate = get("purchaseDate");

    if (
      laptops.some(
        (l) => l.id !== laptop?.id && l.assetTag.toUpperCase() === assetTag,
      )
    ) {
      setError(`Asset tag ${assetTag} is already in use.`);
      return;
    }

    const charger = {
      connector: get("chargerConnector"),
      wattage: Number(get("chargerWattage")),
      partNumber: get("chargerPartNumber"),
      serialNumber: get("chargerSerialNumber").toUpperCase(),
      condition: get("chargerCondition") as ChargerCondition,
    };

    if (laptop) {
      onSave?.({
        ...laptop,
        assetTag,
        brand: get("brand"),
        model: get("model"),
        serialNumber: get("serialNumber").toUpperCase(),
        cpu: get("cpu"),
        ram: get("ram"),
        storage: get("storage"),
        os: get("os"),
        color: get("color"),
        colorHex,
        purchaseDate,
        warrantyYears: Number(get("warrantyYears")),
        charger,
      });
      setError(null);
      setOpen(false);
      return;
    }
    if (status === "In use" && !handler) {
      setError("A laptop that is in use needs a handler.");
      return;
    }

    const assignedHandler = status === "In use" || status === "In repair";
    const today = toIsoDate(new Date());

    onAdd?.({
      id: crypto.randomUUID(),
      assetTag,
      brand: get("brand"),
      model: get("model"),
      serialNumber: get("serialNumber").toUpperCase(),
      cpu: get("cpu"),
      ram: get("ram"),
      storage: get("storage"),
      os: get("os"),
      color: get("color"),
      colorHex,
      handler: assignedHandler && handler ? handler : null,
      department: assignedHandler && handler ? department || null : null,
      purchaseDate,
      warrantyYears: Number(get("warrantyYears")),
      status,
      charger,
      history: [
        assignedHandler && handler
          ? {
              handler,
              department: department || undefined,
              from: today < purchaseDate ? purchaseDate : today,
              to: null,
            }
          : {
              handler: null,
              from: purchaseDate,
              to: null,
              note: status === "Retired" ? "Retired" : "Ready to assign",
            },
      ],
    });

    setError(null);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      {openProp === undefined && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add laptop
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            {editing ? "Edit laptop" : "Add laptop"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update the details of ${laptop.assetTag}.`
              : "Register a laptop and its charger in the inventory."}
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-col gap-6 overflow-y-auto px-6 py-5"
        >
          <FormSection title="Laptop">
            <FormField label="Brand" htmlFor="brand">
              <Input
                id="brand"
                name="brand"
                defaultValue={laptop?.brand}
                list="brand-options"
                placeholder="e.g. Lenovo"
                required
              />
              <datalist id="brand-options">
                {brands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Model" htmlFor="model">
              <Input
                id="model"
                name="model"
                defaultValue={laptop?.model}
                placeholder="e.g. ThinkPad T14 Gen 5"
                required
              />
            </FormField>
            <FormField label="Serial number" htmlFor="serialNumber">
              <Input
                id="serialNumber"
                name="serialNumber"
                defaultValue={laptop?.serialNumber}
                className="font-mono"
                required
              />
            </FormField>
            <FormField label="Asset tag" htmlFor="assetTag">
              <Input
                id="assetTag"
                name="assetTag"
                defaultValue={laptop?.assetTag ?? nextAssetTag(laptops)}
                className="font-mono"
                required
              />
            </FormField>
            <FormField label="Color" htmlFor="color">
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Color swatch"
                  value={colorHex}
                  onChange={(event) => setColorHex(event.target.value)}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
                <Input
                  id="color"
                  name="color"
                  defaultValue={laptop?.color}
                  placeholder="e.g. Space Black"
                  required
                />
              </div>
            </FormField>
          </FormSection>

          <FormSection title="Specifications">
            <FormField label="Processor" htmlFor="cpu">
              <Input
                id="cpu"
                name="cpu"
                defaultValue={laptop?.cpu}
                placeholder="e.g. Intel Core i7-1365U"
                required
              />
            </FormField>
            <FormField label="Memory" htmlFor="ram">
              <Input
                id="ram"
                name="ram"
                defaultValue={laptop?.ram}
                placeholder="e.g. 16 GB"
                required
              />
            </FormField>
            <FormField label="Storage" htmlFor="storage">
              <Input
                id="storage"
                name="storage"
                defaultValue={laptop?.storage}
                placeholder="e.g. 512 GB SSD"
                required
              />
            </FormField>
            <FormField label="Operating system" htmlFor="os">
              <Input
                id="os"
                name="os"
                defaultValue={laptop?.os}
                placeholder="e.g. Windows 11 Pro"
                required
              />
            </FormField>
          </FormSection>

          <FormSection title={editing ? "Purchase" : "Assignment & purchase"}>
            {!editing && (
              <>
                <FormField label="Status" htmlFor="status">
                  <select
                    id="status"
                    name="status"
                    defaultValue="Vacant"
                    className={selectClass}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Handler" htmlFor="handler" optional>
                  <Input id="handler" name="handler" placeholder="Full name" />
                </FormField>
                <FormField label="Department" htmlFor="department" optional>
                  <Input
                    id="department"
                    name="department"
                    placeholder="e.g. Engineering"
                  />
                </FormField>
              </>
            )}
            <FormField label="Purchase date" htmlFor="purchaseDate">
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={laptop?.purchaseDate}
                max={toIsoDate(new Date())}
                required
              />
            </FormField>
            <FormField label="Warranty (years)" htmlFor="warrantyYears">
              <Input
                id="warrantyYears"
                name="warrantyYears"
                type="number"
                min={0}
                max={10}
                defaultValue={laptop?.warrantyYears ?? 3}
                required
              />
            </FormField>
          </FormSection>

          <FormSection title="Charger">
            <FormField label="Connector" htmlFor="chargerConnector">
              <select
                id="chargerConnector"
                name="chargerConnector"
                defaultValue={laptop?.charger.connector ?? "USB-C"}
                className={selectClass}
              >
                {(laptop && !connectors.includes(laptop.charger.connector)
                  ? [laptop.charger.connector, ...connectors]
                  : connectors
                ).map((connector) => (
                  <option key={connector} value={connector}>
                    {connector}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Power (W)" htmlFor="chargerWattage">
              <Input
                id="chargerWattage"
                name="chargerWattage"
                type="number"
                min={5}
                max={400}
                defaultValue={laptop?.charger.wattage ?? 65}
                required
              />
            </FormField>
            <FormField label="Condition" htmlFor="chargerCondition">
              <select
                id="chargerCondition"
                name="chargerCondition"
                defaultValue={laptop?.charger.condition ?? "Good"}
                className={selectClass}
              >
                {chargerConditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Part number" htmlFor="chargerPartNumber" optional>
              <Input
                id="chargerPartNumber"
                name="chargerPartNumber"
                defaultValue={laptop?.charger.partNumber}
                className="font-mono"
              />
            </FormField>
            <FormField
              label="Serial number"
              htmlFor="chargerSerialNumber"
              optional
            >
              <Input
                id="chargerSerialNumber"
                name="chargerSerialNumber"
                defaultValue={laptop?.charger.serialNumber}
                className="font-mono"
              />
            </FormField>
          </FormSection>
        </form>

        <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
          {error && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form={formId}>
            {editing ? <CheckIcon /> : <PlusIcon />}
            {editing ? "Save changes" : "Add laptop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
