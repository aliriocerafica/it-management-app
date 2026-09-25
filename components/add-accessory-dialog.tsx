"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

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
import { statuses, type LaptopStatus } from "@/lib/laptops";

function nextAssetTag(items: Accessory[], prefix: string) {
  const max = items.reduce((highest, item) => {
    const n = Number(item.assetTag.replace(/\D/g, ""));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function AddAccessoryDialog({
  config,
  items,
  onAdd,
}: {
  config: AccessoryConfig;
  items: Accessory[];
  onAdd: (item: Accessory) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorHex, setColorHex] = useState("#2b2b2d");

  const noun = config.singular.toLowerCase();
  const brands = [...new Set(items.map((item) => item.brand))].sort();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? "").trim();

    const assetTag = get("assetTag").toUpperCase();
    const status = get("status") as LaptopStatus;
    const handler = get("handler");
    const department = get("department");
    const purchaseDate = get("purchaseDate");

    if (items.some((item) => item.assetTag.toUpperCase() === assetTag)) {
      setError(`Asset tag ${assetTag} is already in use.`);
      return;
    }
    if (status === "In use" && !handler) {
      setError(`A ${noun} that is in use needs a handler.`);
      return;
    }

    const assignedHandler = status === "In use" || status === "In repair";
    const today = toIsoDate(new Date());

    onAdd({
      id: crypto.randomUUID(),
      kind: config.kind,
      assetTag,
      brand: get("brand"),
      model: get("model"),
      serialNumber: get("serialNumber").toUpperCase(),
      color: get("color"),
      colorHex,
      handler: assignedHandler && handler ? handler : null,
      department: assignedHandler && handler ? department || null : null,
      purchaseDate,
      warrantyYears: Number(get("warrantyYears")),
      status,
      specs: Object.fromEntries(
        config.specFields.map((field) => [field.key, get(`spec-${field.key}`)]),
      ),
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
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Add {noun}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            Add {noun}
          </DialogTitle>
          <DialogDescription>
            Register a {noun} in the inventory.
          </DialogDescription>
        </DialogHeader>

        <form
          id={`add-${config.kind}-form`}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-col gap-6 overflow-y-auto px-6 py-5"
        >
          <FormSection title={config.singular}>
            <FormField label="Brand" htmlFor="brand">
              <Input
                id="brand"
                name="brand"
                list={`${config.kind}-brand-options`}
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
                placeholder={config.modelPlaceholder}
                required
              />
            </FormField>
            <FormField label="Serial number" htmlFor="serialNumber">
              <Input
                id="serialNumber"
                name="serialNumber"
                className="font-mono"
                required
              />
            </FormField>
            <FormField label="Asset tag" htmlFor="assetTag">
              <Input
                id="assetTag"
                name="assetTag"
                defaultValue={nextAssetTag(items, config.tagPrefix)}
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
                  placeholder="e.g. Black"
                  required
                />
              </div>
            </FormField>
          </FormSection>

          <FormSection title="Specifications">
            {config.specFields.map((field) => {
              const id = `spec-${field.key}`;
              return (
                <FormField key={field.key} label={field.label} htmlFor={id}>
                  {field.options ? (
                    <select
                      id={id}
                      name={id}
                      defaultValue={field.options[0]}
                      className={selectClass}
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      name={id}
                      placeholder={field.placeholder}
                      required
                    />
                  )}
                </FormField>
              );
            })}
          </FormSection>

          <FormSection title="Assignment & purchase">
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
            <FormField label="Purchase date" htmlFor="purchaseDate">
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
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
                defaultValue={2}
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
          <Button type="submit" form={`add-${config.kind}-form`}>
            <PlusIcon />
            Add {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
