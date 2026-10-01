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
import { Input } from "@/components/ui/input";
import { type Accessory, type AccessoryConfig } from "@/lib/accessories";
import { errorMessage } from "@/lib/inventory-api";
import { statuses, type LaptopStatus } from "@/lib/laptops";

function nextAssetTag(items: Accessory[], prefix: string) {
  const max = items.reduce((highest, item) => {
    const n = Number(item.assetTag.replace(/\D/g, ""));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

// Without `item` this is the "Add" dialog with its own trigger button. With
// `item` it edits that accessory's details and is opened by the parent.
// Status, handler and history are left alone: those change through the
// assign / return / repair actions.
export function AddAccessoryDialog({
  config,
  items,
  onAdd,
  item,
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (item: Accessory) => Promise<void>;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [colorHex, setColorHex] = useState(item?.colorHex ?? "#2b2b2d");

  const editing = item != null;
  const noun = config.singular.toLowerCase();
  const brands = [...new Set(items.map((item) => item.brand))].sort();
  const formId = `${editing ? "edit" : "add"}-${config.kind}-form`;

  async function submit(
    next: Accessory,
    save?: (item: Accessory) => Promise<void>,
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

    if (
      items.some(
        (other) =>
          other.id !== item?.id && other.assetTag.toUpperCase() === assetTag,
      )
    ) {
      setError(`Asset tag ${assetTag} is already in use.`);
      return;
    }
    const serialNumber = get("serialNumber").toUpperCase();
    if (
      items.some(
        (other) =>
          other.id !== item?.id &&
          other.serialNumber.toUpperCase() === serialNumber,
      )
    ) {
      setError(`Serial number ${serialNumber} is already in use.`);
      return;
    }

    const specs = Object.fromEntries(
      config.specFields.map((field) => [field.key, get(`spec-${field.key}`)]),
    );

    if (item) {
      void submit(
        {
          ...item,
          assetTag,
          brand: get("brand"),
          model: get("model"),
          serialNumber,
          color: get("color"),
          colorHex,
          purchaseDate,
          warrantyYears: Number(get("warrantyYears")),
          specs,
        },
        onSave,
      );
      return;
    }
    if (status === "In use" && !handler) {
      setError(`A ${noun} that is in use needs a handler.`);
      return;
    }

    const assignedHandler = status === "In use" || status === "In repair";
    const today = toIsoDate(new Date());

    void submit(
      {
        id: crypto.randomUUID(),
        kind: config.kind,
        assetTag,
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
      },
      onAdd,
    );
  }

  return (
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
          Add {noun}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            {editing ? `Edit ${noun}` : `Add ${noun}`}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update the details of ${item.assetTag}.`
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
                defaultValue={item?.brand}
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
                defaultValue={item?.model}
                placeholder={config.modelPlaceholder}
                required
              />
            </FormField>
            <FormField label="Serial number" htmlFor="serialNumber">
              <Input
                id="serialNumber"
                name="serialNumber"
                defaultValue={item?.serialNumber}
                className="font-mono"
                required
              />
            </FormField>
            <FormField label="Asset tag" htmlFor="assetTag">
              <Input
                id="assetTag"
                name="assetTag"
                defaultValue={
                  item?.assetTag ?? nextAssetTag(items, config.tagPrefix)
                }
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
                  defaultValue={item?.color}
                  placeholder="e.g. Black"
                  required
                />
              </div>
            </FormField>
          </FormSection>

          <FormSection title="Specifications">
            {config.specFields.map((field) => {
              const id = `spec-${field.key}`;
              const current = item?.specs[field.key];
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
                defaultValue={item?.purchaseDate}
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
                max={25}
                defaultValue={item?.warrantyYears ?? 2}
                required
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
          <Button type="submit" form={formId} disabled={saving}>
            {editing ? <CheckIcon /> : <PlusIcon />}
            {saving ? "Saving…" : editing ? "Save changes" : `Add ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
