"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  PackageIcon,
  UserCheckIcon,
  WrenchIcon,
  type LucideIcon,
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
import { type TrackedItem } from "@/lib/laptops";
import { cn } from "@/lib/utils";

export type RepairOutcome = "handler" | "stock" | "retire";

export function ReturnFromRepairDialog({
  laptop,
  open,
  onOpenChange,
  onConfirm,
  noun = "laptop",
}: {
  laptop: TrackedItem | null;
  noun?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (outcome: RepairOutcome, note: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {laptop && (
          <ReturnForm laptop={laptop} onConfirm={onConfirm} noun={noun} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({
  laptop,
  onConfirm,
  noun,
}: {
  laptop: TrackedItem;
  noun: string;
  onConfirm: (outcome: RepairOutcome, note: string) => void;
}) {
  const options: {
    value: RepairOutcome;
    icon: LucideIcon;
    title: string;
    description: string;
  }[] = [
    ...(laptop.handler
      ? [
          {
            value: "handler" as const,
            icon: UserCheckIcon,
            title: `Return to ${laptop.handler}`,
            description: "Repaired. Status goes back to In use.",
          },
        ]
      : []),
    {
      value: "stock",
      icon: PackageIcon,
      title: "Return to IT stock",
      description: "Repaired. Status becomes Vacant, ready to assign.",
    },
    {
      value: "retire",
      icon: ArchiveIcon,
      title: "Beyond repair, retire it",
      description: "Status becomes Retired.",
    },
  ];

  const [outcome, setOutcome] = useState<RepairOutcome>(options[0].value);
  const [note, setNote] = useState("");

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <WrenchIcon className="size-4" />
          Return from repair
        </DialogTitle>
        <DialogDescription>
          {laptop.brand} {laptop.model} ·{" "}
          <span className="font-mono text-xs">{laptop.assetTag}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div
          role="radiogroup"
          aria-label="Repair outcome"
          className="flex flex-col gap-2"
        >
          {options.map((option) => {
            const isSelected = option.value === outcome;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setOutcome(option.value)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? "border-foreground/30 bg-muted"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                  <option.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {option.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="repair-note" className="text-xs">
            Repair notes
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="repair-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              outcome === "retire"
                ? "e.g. Motherboard failure, not worth fixing"
                : "e.g. Keyboard replaced"
            }
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          variant={outcome === "retire" ? "destructive" : "default"}
          onClick={() => onConfirm(outcome, note.trim())}
        >
          {outcome === "retire" ? `Retire ${noun}` : "Mark as repaired"}
        </Button>
      </DialogFooter>
    </>
  );
}
