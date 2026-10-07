"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  LaptopIcon,
  MemoryStickIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Accessory } from "@/lib/accessories";
import { adjustRam, parseGb, type RamHost } from "@/lib/ram";
import { cn } from "@/lib/utils";

// Installs a RAM module in a laptop: the RAM equivalent of assigning an
// item to a person. The laptop's memory goes up by the module's capacity.
export function InstallRamDialog({
  item,
  laptops,
  modules,
  open,
  onOpenChange,
  onInstall,
}: {
  item: Accessory | null;
  laptops: RamHost[];
  // Every RAM module, to show what each laptop already has installed.
  modules: Accessory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (laptop: RamHost, note: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && item && (
          <InstallForm
            key={item.id}
            item={item}
            laptops={laptops}
            modules={modules}
            onInstall={onInstall}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InstallForm({
  item,
  laptops,
  modules,
  onInstall,
}: {
  item: Accessory;
  laptops: RamHost[];
  modules: Accessory[];
  onInstall: (laptop: RamHost, note: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const capacity = parseGb(item.specs.capacity);

  // Asset tags of the modules already in each laptop.
  const installed = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ram of modules) {
      if (!ram.laptopId || ram.status !== "In use") continue;
      map.set(ram.laptopId, [
        ...(map.get(ram.laptopId) ?? []),
        ram.assetTag,
      ]);
    }
    return map;
  }, [modules]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return laptops
      .filter((laptop) => laptop.status !== "Retired")
      .filter(
        (laptop) =>
          !q ||
          [
            laptop.assetTag,
            laptop.brand,
            laptop.model,
            laptop.ram,
            laptop.handler ?? "",
          ].some((value) => value.toLowerCase().includes(q)),
      );
  }, [laptops, query]);

  const selected = laptops.find((laptop) => laptop.id === selectedId) ?? null;
  const newRam =
    selected && capacity ? adjustRam(selected.ram, capacity) : null;
  const unknownMemory = selected != null && parseGb(selected.ram) === null;

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          Install in laptop
        </DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <MemoryStickIcon className="size-3.5" />
          {item.brand} {item.model}
          <span aria-hidden>·</span>
          {item.specs.capacity} {item.specs.type}
          <span aria-hidden>·</span>
          <span className="font-mono text-xs">{item.assetTag}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-3 px-6 pt-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by asset tag, model or handler"
            className="pl-8"
            autoFocus
          />
        </div>

        <div
          role="radiogroup"
          aria-label="Laptops"
          className="-mx-2 flex max-h-80 min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-1"
        >
          {list.map((laptop) => {
            const isSelected = laptop.id === selectedId;
            const modulesIn = installed.get(laptop.id);
            return (
              <button
                key={laptop.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedId(laptop.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? "border-foreground/30 bg-muted"
                    : "border-transparent hover:bg-muted/60",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <LaptopIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">
                    <span className="font-mono">{laptop.assetTag}</span>{" "}
                    <span className="font-normal text-muted-foreground">
                      {laptop.brand} {laptop.model}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[laptop.handler ?? "Unassigned", laptop.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="shrink-0 text-right leading-tight">
                  <div className="text-xs font-medium tabular-nums">
                    {laptop.ram}
                  </div>
                  {modulesIn && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      +{modulesIn.join(", ")}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-input",
                  )}
                >
                  {isSelected && <CheckIcon className="size-3" />}
                </span>
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {laptops.length
                ? "No laptops match your search."
                : "There are no laptops in the inventory yet."}
            </p>
          )}
        </div>

        {selected && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              unknownMemory || !capacity
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {!capacity ? (
              <>
                This module has no capacity set, so {selected.assetTag}&apos;s
                memory won&apos;t change. Edit the module to set it.
              </>
            ) : unknownMemory ? (
              <>
                {selected.assetTag}&apos;s memory is &ldquo;{selected.ram}
                &rdquo;, so it can&apos;t be added to. Set its total by editing
                the laptop.
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {selected.assetTag} memory: {selected.ram}
                <ArrowRightIcon className="size-3" />
                <span className="font-medium text-foreground">{newRam}</span>
              </span>
            )}
          </p>
        )}

        <div className="flex flex-col gap-1.5 border-t border-border pt-3 pb-4">
          <Label htmlFor="install-note" className="text-xs">
            Note
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="install-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Upgrade for slow performance"
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
        {selected && (
          <p className="mr-auto truncate text-sm text-muted-foreground">
            Installing in{" "}
            <span className="font-mono font-medium text-foreground">
              {selected.assetTag}
            </span>
          </p>
        )}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          disabled={!selected}
          onClick={() => selected && onInstall(selected, note.trim())}
        >
          <MemoryStickIcon />
          Install
        </Button>
      </DialogFooter>
    </>
  );
}
