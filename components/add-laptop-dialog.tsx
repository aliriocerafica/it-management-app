"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  PlusIcon,
  PlugIcon,
  RepeatIcon,
  SearchIcon,
  Undo2Icon,
  WrenchIcon,
} from "lucide-react";

import { AssignmentFields } from "@/components/assignment-fields";
import { FormSelect } from "@/components/form-select";
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
import {
  HistoryEditor,
  currentHolder,
  fromDrafts,
  toDrafts,
} from "@/components/history-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  statuses,
  type Charger,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { parseAnydeskAddress } from "@/lib/anydesk";
import { errorMessage } from "@/lib/inventory-api";
import { type Accessory } from "@/lib/accessories";
import {
  chargerConditions,
  chargerConnectors,
  chargerFromAccessory,
  chargerInLaptop,
  chargerLabel,
  installChargerInLaptop,
  missingCharger,
  removeChargerFromLaptop,
  vacantChargers,
} from "@/lib/chargers";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultCharger(): Charger {
  return {
    connector: "USB-C",
    wattage: 65,
    partNumber: "",
    serialNumber: "",
    condition: "Good",
  };
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

// The fault still to fix, edited in its own small dialog so a long
// description has room. The hidden input carries it into the form.
function PendingRepairField({ defaultValue }: { defaultValue: string }) {
  const [issue, setIssue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <FormField
      label="Pending repair"
      htmlFor="repairIssueButton"
      optional
      className="min-w-0"
    >
      <input type="hidden" name="repairIssue" value={issue} />
      <Button
        id="repairIssueButton"
        type="button"
        variant="outline"
        title={issue || undefined}
        className="w-full min-w-0 justify-start font-normal"
        onClick={() => {
          setDraft(issue);
          setOpen(true);
        }}
      >
        <WrenchIcon className="text-muted-foreground" />
        <span className={cn("truncate", !issue && "text-muted-foreground")}>
          {issue || "None"}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-6 py-5 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <WrenchIcon className="size-4" />
              Pending repair
            </DialogTitle>
            <DialogDescription>
              The fault still to fix. Leave empty if there is none.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <textarea
              aria-label="Pending repair"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. Keyboard keys not responding, battery drains in 1 hour"
              rows={5}
              autoFocus
              className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                setIssue(draft.trim());
                setOpen(false);
              }}
            >
              <CheckIcon />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormField>
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
  chargers = [],
  onSaveCharger,
}: {
  laptops: Laptop[];
  // Both resolve once the database has the change; a rejection keeps the
  // dialog open and shows the error.
  onAdd?: (laptop: Laptop) => Promise<void>;
  laptop?: Laptop | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (laptop: Laptop) => Promise<void>;
  chargers?: Accessory[];
  onSaveCharger?: (item: Accessory) => Promise<Accessory>;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [colorHex, setColorHex] = useState(laptop?.colorHex ?? "#2b2b2d");
  const [historyDrafts, setHistoryDrafts] = useState(() =>
    toDrafts(laptop?.history ?? []),
  );
  const [chargerDraft, setChargerDraft] = useState<Charger>(
    () => laptop?.charger ?? defaultCharger(),
  );
  const [pickMode, setPickMode] = useState<"assign" | "replace" | null>(null);
  const [chargerBusy, setChargerBusy] = useState(false);

  const editing = laptop != null;
  const formId = editing ? "edit-laptop-form" : "add-laptop-form";
  const brands = [...new Set(laptops.map((l) => l.brand))].sort();
  const handlerNames = [
    ...new Set(
      laptops.flatMap((l) => l.history.flatMap((entry) => entry.handler ?? [])),
    ),
  ].sort();
  const installedCharger = laptop
    ? chargerInLaptop(chargers, laptop.id)
    : undefined;
  const stockChargers = vacantChargers(chargers);

  async function persistCharger(next: Accessory, snapshot: Charger) {
    if (!onSaveCharger) {
      throw new Error("Charger stock isn't available on this form.");
    }
    setChargerBusy(true);
    try {
      await onSaveCharger(next);
      setChargerDraft(snapshot);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setChargerBusy(false);
    }
  }

  async function returnCharger() {
    if (!laptop) return;
    const today = toIsoDate(new Date());
    const current = installedCharger;
    if (!current) {
      setChargerDraft(missingCharger(chargerDraft));
      return;
    }
    try {
      await persistCharger(
        removeChargerFromLaptop(current, laptop, today),
        missingCharger(chargerDraft),
      );
    } catch {
      // persistCharger already surfaced the error
    }
  }

  async function assignPicked(item: Accessory) {
    if (!laptop) return;
    const today = toIsoDate(new Date());
    const installed = installChargerInLaptop(item, laptop, "", today);
    try {
      await persistCharger(installed, chargerFromAccessory(installed));
      setPickMode(null);
    } catch {
      // persistCharger already surfaced the error
    }
  }

  async function submit(
    next: Laptop,
    save?: (laptop: Laptop) => Promise<void>,
  ) {
    setSaving(true);
    try {
      await save?.(next);
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? "").trim();

    const assetTag = get("assetTag").toUpperCase();
    const status = get("status") as LaptopStatus;
    const handler = get("handler");
    const department = get("department");
    const purchaseDate = get("purchaseDate");
    const anydeskInput = get("anydeskAddress");
    const anydeskAddress = anydeskInput
      ? parseAnydeskAddress(anydeskInput)
      : null;
    if (anydeskInput && !anydeskAddress) {
      setError("AnyDesk address must be 9 or 10 digits.");
      return;
    }

    if (
      laptops.some(
        (l) => l.id !== laptop?.id && l.assetTag.toUpperCase() === assetTag,
      )
    ) {
      setError(`Asset tag ${assetTag} is already in use.`);
      return;
    }
    const serialNumber = get("serialNumber").toUpperCase();
    if (
      laptops.some(
        (l) =>
          l.id !== laptop?.id && l.serialNumber.toUpperCase() === serialNumber,
      )
    ) {
      setError(`Serial number ${serialNumber} is already in use.`);
      return;
    }

    const charger = editing
      ? {
          ...chargerDraft,
          serialNumber: chargerDraft.serialNumber.toUpperCase(),
        }
      : {
          connector: get("chargerConnector"),
          wattage: Number(get("chargerWattage")),
          partNumber: get("chargerPartNumber"),
          serialNumber: get("chargerSerialNumber").toUpperCase(),
          condition: get("chargerCondition") as Charger["condition"],
        };

    if (laptop) {
      const edited = fromDrafts(historyDrafts);
      if ("error" in edited) {
        setError(edited.error);
        return;
      }
      void submit(
        {
          ...laptop,
          ...currentHolder(edited.history, laptop.status),
          history: edited.history,
          assetTag,
          brand: get("brand"),
          model: get("model"),
          serialNumber,
          cpu: get("cpu"),
          ram: get("ram"),
          storage: get("storage"),
          os: get("os"),
          color: get("color"),
          colorHex,
          purchaseDate,
          warrantyYears: Number(get("warrantyYears")),
          price: get("price") ? Number(get("price")) : null,
          repairIssue: get("repairIssue") || null,
          charger,
          anydeskAddress,
        },
        onSave,
      );
      return;
    }
    if (status === "In use" && !handler) {
      setError("A laptop that is in use needs a handler.");
      return;
    }

    const assignedHandler = status === "In use" || status === "In repair";
    const today = toIsoDate(new Date());

    void submit(
      {
        id: crypto.randomUUID(),
        assetTag,
        brand: get("brand"),
        model: get("model"),
        serialNumber,
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
        price: get("price") ? Number(get("price")) : null,
        status,
        charger,
        anydeskAddress,
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
      },
      onAdd,
    );
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
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
          className="flex min-h-0 flex-col gap-6 overflow-y-auto scrollbar-none px-6 py-5 [&::-webkit-scrollbar]:hidden"
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
            <FormField
              label="AnyDesk address"
              htmlFor="anydeskAddress"
              optional
            >
              <Input
                id="anydeskAddress"
                name="anydeskAddress"
                inputMode="numeric"
                defaultValue={laptop?.anydeskAddress ?? ""}
                placeholder="e.g. 123 456 789"
                className="font-mono"
              />
            </FormField>
          </FormSection>

          <FormSection title={editing ? "Purchase" : "Assignment & purchase"}>
            {!editing && (
              <AssignmentFields
                statuses={statuses}
                holders={laptops}
                noun="laptop"
              />
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
            <FormField label="Price" htmlFor="price" optional>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 45000"
                defaultValue={laptop?.price ?? ""}
              />
            </FormField>
            {editing && (
              <PendingRepairField defaultValue={laptop?.repairIssue ?? ""} />
            )}
          </FormSection>

          <FormSection title="Charger">
            <FormField label="Connector" htmlFor="chargerConnector">
              <FormSelect
                id="chargerConnector"
                name="chargerConnector"
                value={editing ? chargerDraft.connector : undefined}
                defaultValue={editing ? undefined : "USB-C"}
                onChange={
                  editing
                    ? (value) =>
                        setChargerDraft((current) => ({
                          ...current,
                          connector: value,
                        }))
                    : undefined
                }
                options={(laptop &&
                !chargerConnectors.includes(laptop.charger.connector)
                  ? [laptop.charger.connector, ...chargerConnectors]
                  : chargerConnectors
                ).map((connector) => ({ value: connector, label: connector }))}
              />
            </FormField>
            <FormField label="Power (W)" htmlFor="chargerWattage">
              <Input
                id="chargerWattage"
                name="chargerWattage"
                type="number"
                min={5}
                max={400}
                value={editing ? chargerDraft.wattage : undefined}
                defaultValue={editing ? undefined : 65}
                onChange={
                  editing
                    ? (event) =>
                        setChargerDraft((current) => ({
                          ...current,
                          wattage: Number(event.target.value) || 0,
                        }))
                    : undefined
                }
                required
              />
            </FormField>
            <FormField label="Condition" htmlFor="chargerCondition">
              <FormSelect
                id="chargerCondition"
                name="chargerCondition"
                value={editing ? chargerDraft.condition : undefined}
                defaultValue={editing ? undefined : "Good"}
                onChange={
                  editing
                    ? (value) =>
                        setChargerDraft((current) => ({
                          ...current,
                          condition: value as Charger["condition"],
                        }))
                    : undefined
                }
                options={chargerConditions.map((condition) => ({
                  value: condition,
                  label: condition,
                }))}
              />
            </FormField>
            <FormField label="Part number" htmlFor="chargerPartNumber" optional>
              <Input
                id="chargerPartNumber"
                name="chargerPartNumber"
                value={editing ? chargerDraft.partNumber : undefined}
                defaultValue={editing ? undefined : ""}
                onChange={
                  editing
                    ? (event) =>
                        setChargerDraft((current) => ({
                          ...current,
                          partNumber: event.target.value,
                        }))
                    : undefined
                }
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
                value={editing ? chargerDraft.serialNumber : undefined}
                defaultValue={editing ? undefined : ""}
                onChange={
                  editing
                    ? (event) =>
                        setChargerDraft((current) => ({
                          ...current,
                          serialNumber: event.target.value,
                        }))
                    : undefined
                }
                className="font-mono"
              />
            </FormField>
            {editing && laptop && (
              <ChargerStockActions
                laptop={laptop}
                charger={chargerDraft}
                chargers={chargers}
                busy={chargerBusy || saving}
                onReturn={() => void returnCharger()}
                onReplace={() => setPickMode("replace")}
                onAssign={() => setPickMode("assign")}
              />
            )}
          </FormSection>
          {editing && (
            <HistoryEditor
              value={historyDrafts}
              onChange={setHistoryDrafts}
              handlerOptions={handlerNames}
            />
          )}
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
          <Button type="submit" form={formId} disabled={saving}>
            {editing ? <CheckIcon /> : <PlusIcon />}
            {saving ? "Saving…" : editing ? "Save changes" : "Add laptop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      <PickChargerDialog
        open={pickMode !== null}
        mode={pickMode ?? "assign"}
        chargers={stockChargers}
        busy={chargerBusy}
        onOpenChange={(next) => {
          if (!next) setPickMode(null);
        }}
        onPick={(item) => void assignPicked(item)}
      />
    </>
  );
}

function ChargerStockActions({
  laptop,
  charger,
  chargers,
  busy,
  onReturn,
  onReplace,
  onAssign,
}: {
  laptop: Laptop;
  charger: Charger;
  chargers: Accessory[];
  busy: boolean;
  onReturn: () => void;
  onReplace: () => void;
  onAssign: () => void;
}) {
  const missing = charger.condition === "Missing";
  const vacant = vacantChargers(chargers);
  const assigned = chargerInLaptop(chargers, laptop.id);

  return (
    <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-5">
      <p className="text-xs text-muted-foreground">
        {missing
          ? "No charger is assigned. Assign one from vacant stock, or fill in the fields if this laptop still has its original adapter."
          : assigned
            ? `Assigned ${assigned.assetTag}. Return it to vacant stock, or replace it with another vacant charger.`
            : "Return sends this adapter back to charger stock. Replace swaps it for a vacant unit."}{" "}
        Stock changes here are saved right away, even if you cancel the rest
        of this form.
      </p>
      <div className="flex flex-wrap gap-2">
        {missing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || vacant.length === 0}
            onClick={onAssign}
          >
            <PlugIcon />
            Assign from stock
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onReturn}
            >
              <Undo2Icon />
              Return
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || vacant.length === 0}
              onClick={onReplace}
            >
              <RepeatIcon />
              Replace
            </Button>
          </>
        )}
        {vacant.length === 0 && (
          <span className="self-center text-xs text-muted-foreground">
            No vacant chargers in stock
          </span>
        )}
      </div>
    </div>
  );
}

function PickChargerDialog({
  open,
  mode,
  chargers,
  busy,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  mode: "assign" | "replace";
  chargers: Accessory[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: Accessory) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chargers.filter(
      (item) =>
        !q ||
        [
          item.assetTag,
          item.brand,
          item.model,
          item.serialNumber,
          item.specs.connector,
          item.specs.wattage,
        ].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [chargers, query]);
  const selected = chargers.find((item) => item.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            {mode === "replace" ? "Replace charger" : "Assign charger"}
          </DialogTitle>
          <DialogDescription>
            {mode === "replace"
              ? "The current charger goes back to vacant stock. Pick the unit that takes its place."
              : "Pick a vacant charger to assign to this laptop."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-3 px-6 pt-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by tag, connector or wattage"
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="-mx-2 flex max-h-72 flex-col gap-1 overflow-y-auto px-2 pb-1">
            {list.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-foreground/30 bg-muted"
                      : "border-transparent hover:bg-muted/60",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <PlugIcon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-sm font-medium">
                      <span className="font-mono">{item.assetTag}</span>{" "}
                      <span className="font-normal text-muted-foreground">
                        {item.brand} {item.model}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {chargerLabel(item)}
                    </div>
                  </div>
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No vacant chargers match.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={!selected || busy}
            onClick={() => selected && onPick(selected)}
          >
            <PlugIcon />
            {busy
              ? "Saving…"
              : mode === "replace"
                ? "Replace"
                : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
