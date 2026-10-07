"use client";

import { useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";

import {
  FormField,
  FormSection,
  selectClass,
  toIsoDate,
} from "@/components/add-laptop-dialog";
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
import { type Accessory, type AccessoryConfig } from "@/lib/accessories";
import { errorMessage } from "@/lib/inventory-api";
import { formatWarranty, lowerNoun } from "@/lib/accessories";
import { statuses, type LaptopStatus } from "@/lib/laptops";

function nextAssetTag(items: Accessory[], prefix: string) {
  const max = items.reduce((highest, item) => {
    const n = Number(item.assetTag.replace(/\D/g, ""));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

// `count` free asset tags counting up from `first` (BT-0020, BT-0021, ...),
// skipping any already in use. Null when `first` doesn't end in a number.
function sequentialTags(first: string, count: number, taken: Set<string>) {
  const match = first.match(/^(.*?)(\d+)$/);
  if (!match) return count === 1 ? [first] : null;
  const [, prefix, digits] = match;
  const tags: string[] = [];
  for (let n = Number(digits); tags.length < count; n++) {
    const tag = `${prefix}${String(n).padStart(digits.length, "0")}`;
    if (tags.length === 0 || !taken.has(tag)) tags.push(tag);
  }
  return tags;
}

const maxCopies = 50;
// 0 years is stored for "No warranty".
const warrantyOptions = [0, 1, 2, 3, 4, 5];

// Without `item` this is the "Add" dialog with its own trigger button. With
// `item` it edits that accessory's details and is opened by the parent.
// Status, handler and history are left alone: those change through the
// assign / return / repair actions. With `template` (and no `item`) it's the
// Add dialog pre-filled from that accessory, for registering a copy.
export function AddAccessoryDialog({
  config,
  items,
  onAdd,
  item,
  template,
  open: openProp,
  onOpenChange,
  onSave,
}: {
  config: AccessoryConfig;
  items: Accessory[];
  // Both resolve once the database has the change; a rejection keeps the
  // dialog open and shows the error.
  onAdd?: (item: Accessory) => Promise<void>;
  item?: Accessory | null;
  template?: Accessory | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (item: Accessory) => Promise<void>;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Where the form's starting values come from: the item being edited, or
  // the one being duplicated.
  const source = item ?? template ?? null;
  const [colorHex, setColorHex] = useState(source?.colorHex ?? "#2b2b2d");
  // Fixed while the dialog is open: `items` grows as copies are saved, and an
  // uncontrolled input's default mustn't change after it mounts. Recomputed
  // on each open, since the toolbar's Add dialog stays mounted between uses.
  const [initialAssetTag, setInitialAssetTag] = useState(
    () => item?.assetTag ?? nextAssetTag(items, config.tagPrefix),
  );
  const [historyDrafts, setHistoryDrafts] = useState(() =>
    toDrafts(item?.history ?? []),
  );

  const editing = item != null;
  // RAM goes into a laptop through Install, never to a person, so it's
  // added without a handler and can't start out "In use".
  const installs = config.installsInLaptop === true;
  const addStatuses = installs
    ? statuses.filter((status) => status !== "In use")
    : statuses;
  const duplicating = !editing && template != null;
  const noun = lowerNoun(config.singular);
  const brands = [...new Set(items.map((item) => item.brand))].sort();
  const handlerNames = [
    ...new Set(
      items.flatMap((other) =>
        other.history.flatMap((entry) => entry.handler ?? []),
      ),
    ),
  ].sort();
  const formId = `${editing ? "edit" : duplicating ? "duplicate" : "add"}-${config.kind}-form`;

  async function submit(
    next: Accessory[],
    save?: (item: Accessory) => Promise<void>,
  ) {
    setSaving(true);
    try {
      // One at a time so each copy lands in the table as it's saved.
      for (const one of next) await save?.(one);
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

    if (
      items.some(
        (other) =>
          other.id !== item?.id && other.assetTag.toUpperCase() === assetTag,
      )
    ) {
      setError(`Asset tag ${assetTag} is already in use.`);
      return;
    }
    // Serials may repeat: accessories often share a batch/lot number.
    const serialNumber = get("serialNumber").toUpperCase();

    const specs = Object.fromEntries(
      config.specFields.map((field) => [field.key, get(`spec-${field.key}`)]),
    );

    if (item) {
      const edited = fromDrafts(historyDrafts);
      if ("error" in edited) {
        setError(edited.error);
        return;
      }
      const holder = currentHolder(edited.history, item.status);
      // Installed RAM has no handler but is still in use, in its laptop.
      if (item.laptopId) holder.status = item.status;
      void submit(
        [{
          ...item,
          ...holder,
          history: edited.history,
          assetTag,
          brand: get("brand"),
          model: get("model"),
          serialNumber,
          color: get("color"),
          colorHex,
          purchaseDate,
          warrantyYears: Number(get("warrantyYears")),
          repairIssue: get("repairIssue") || null,
          specs,
        }],
        onSave,
      );
      return;
    }
    if (status === "In use" && !handler) {
      setError(`A ${noun} that is in use needs a handler.`);
      return;
    }

    const copies = duplicating ? Number(get("copies")) : 1;
    if (!Number.isInteger(copies) || copies < 1 || copies > maxCopies) {
      setError(`Number of copies must be between 1 and ${maxCopies}.`);
      return;
    }
    const tags = sequentialTags(
      assetTag,
      copies,
      new Set(items.map((other) => other.assetTag.toUpperCase())),
    );
    if (!tags) {
      setError("To add several copies, end the asset tag with a number.");
      return;
    }

    const assignedHandler = status === "In use" || status === "In repair";
    const today = toIsoDate(new Date());

    void submit(
      tags.map((tag) => ({
        id: crypto.randomUUID(),
        kind: config.kind,
        assetTag: tag,
        brand: get("brand"),
        model: get("model"),
        serialNumber,
        color: get("color"),
        colorHex,
        handler: assignedHandler && handler ? handler : null,
        department: assignedHandler && handler ? department || null : null,
        purchaseDate,
        warrantyYears: Number(get("warrantyYears")),
        status,
        specs,
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
      })),
      onAdd,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next && !item) {
          setInitialAssetTag(nextAssetTag(items, config.tagPrefix));
        }
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      {openProp === undefined && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add {noun}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            {editing
              ? `Edit ${noun}`
              : duplicating
                ? `Duplicate ${noun}`
                : `Add ${noun}`}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update the details of ${item.assetTag}.`
              : duplicating
                ? `Register a copy of ${template.assetTag}. It gets its own asset tag; check the serial number.`
                : `Register a ${noun} in the inventory.`}
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-col gap-6 overflow-y-auto px-6 py-5"
        >
          <FormSection title={config.singular}>
            <FormField label="Brand" htmlFor="brand">
              <Input
                id="brand"
                name="brand"
                list={`${config.kind}-brand-options`}
                defaultValue={source?.brand}
                placeholder={config.brandPlaceholder}
                required
              />
              <datalist id={`${config.kind}-brand-options`}>
                {brands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Model" htmlFor="model">
              <Input
                id="model"
                name="model"
                defaultValue={source?.model}
                placeholder={config.modelPlaceholder}
                required
              />
            </FormField>
            <FormField label="Serial number" htmlFor="serialNumber">
              <Input
                id="serialNumber"
                name="serialNumber"
                defaultValue={source?.serialNumber}
                className="font-mono"
                required
              />
            </FormField>
            <FormField
              label={duplicating ? "First asset tag" : "Asset tag"}
              htmlFor="assetTag"
            >
              <Input
                id="assetTag"
                name="assetTag"
                defaultValue={initialAssetTag}
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
                  defaultValue={source?.color}
                  placeholder="e.g. Black"
                  required
                />
              </div>
            </FormField>
            {duplicating && (
              <FormField label="Number of copies" htmlFor="copies">
                <Input
                  id="copies"
                  name="copies"
                  type="number"
                  min={1}
                  max={maxCopies}
                  defaultValue={1}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Asset tags count up from the first one, skipping tags in
                  use.
                </p>
              </FormField>
            )}
          </FormSection>

          <FormSection title="Specifications">
            {config.specFields.map((field) => {
              const id = `spec-${field.key}`;
              const current = source?.specs[field.key];
              // Keep a stored value that's no longer in the option list.
              const options =
                field.options && current && !field.options.includes(current)
                  ? [current, ...field.options]
                  : field.options;
              return (
                <FormField key={field.key} label={field.label} htmlFor={id}>
                  {options ? (
                    <select
                      id={id}
                      name={id}
                      defaultValue={current || options[0]}
                      className={selectClass}
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      name={id}
                      defaultValue={current}
                      placeholder={field.placeholder}
                      required
                    />
                  )}
                </FormField>
              );
            })}
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
                    {addStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </FormField>
                {!installs && (
                  <>
                    <FormField label="Handler" htmlFor="handler" optional>
                      <Input
                        id="handler"
                        name="handler"
                        placeholder="Full name"
                      />
                    </FormField>
                    <FormField
                      label="Department"
                      htmlFor="department"
                      optional
                    >
                      <Input
                        id="department"
                        name="department"
                        placeholder="e.g. Engineering"
                      />
                    </FormField>
                  </>
                )}
              </>
            )}
            <FormField label="Purchase date" htmlFor="purchaseDate">
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={source?.purchaseDate}
                max={toIsoDate(new Date())}
                required
              />
            </FormField>
            <FormField label="Warranty" htmlFor="warrantyYears">
              <select
                id="warrantyYears"
                name="warrantyYears"
                defaultValue={source?.warrantyYears ?? 2}
                className={selectClass}
              >
                {/* Keep a stored length that's no longer in the list. */}
                {[
                  ...new Set([
                    ...warrantyOptions,
                    ...(source ? [source.warrantyYears] : []),
                  ]),
                ]
                  .sort((a, b) => a - b)
                  .map((years) => (
                    <option key={years} value={years}>
                      {formatWarranty(years)}
                    </option>
                  ))}
              </select>
            </FormField>
            {editing && (
              <FormField
                label="Pending repair"
                htmlFor="repairIssue"
                optional
                className="sm:col-span-2 lg:col-span-3"
              >
                <Input
                  id="repairIssue"
                  name="repairIssue"
                  defaultValue={item?.repairIssue ?? ""}
                  placeholder="Fault still to fix. Leave empty if none"
                />
              </FormField>
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
            {saving
              ? "Saving…"
              : editing
                ? "Save changes"
                : duplicating
                  ? "Add copies"
                  : `Add ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
