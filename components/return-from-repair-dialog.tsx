"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  PackageIcon,
  TriangleAlertIcon,
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

// `pendingIssue` is set when the item goes back into use before the repair
// is finished; it stays on the item as a "Pending repair" alert.
export type RepairConfirm = (
  outcome: RepairOutcome,
  note: string,
  pendingIssue: string | null,
) => void;

export function ReturnFromRepairDialog({
  laptop,
  open,
  onOpenChange,
  onConfirm,
  noun = "laptop",
}: {
  laptop: (TrackedItem & { repairIssue?: string | null }) | null;
  noun?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: RepairConfirm;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {laptop && (
          <ReturnForm
            key={laptop.assetTag}
            laptop={laptop}
            onConfirm={onConfirm}
            noun={noun}
          />
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
  laptop: TrackedItem & { repairIssue?: string | null };
  noun: string;
  onConfirm: RepairConfirm;
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
            description: "Status goes back to In use.",
          },
        ]
      : []),
    {
      value: "stock",
      icon: PackageIcon,
      title: "Return to IT stock",
      description: "Status becomes Vacant, ready to assign.",
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
  const [fullyRepaired, setFullyRepaired] = useState(true);
  const [pendingIssue, setPendingIssue] = useState(laptop.repairIssue ?? "");
  const retiring = outcome === "retire";
  const pending = !retiring && !fullyRepaired;
  const missingIssue = pending && !pendingIssue.trim();

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <WrenchIcon className="size-4" />
          Release from repair
        </DialogTitle>
        <DialogDescription>
          {laptop.brand} {laptop.model} ·{" "}
          <span className="font-mono text-xs">{laptop.assetTag}</span>
          <span className="mt-1 block">
            Release it back to its holder or to stock, whether or not the repair
            is finished.
          </span>
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

        {!retiring && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Repair status</span>
            <div
              role="radiogroup"
              aria-label="Repair status"
              className="grid grid-cols-2 gap-2"
            >
              {[
                { value: true, label: "Fully repaired" },
                { value: false, label: "Repair still pending" },
              ].map((choice) => {
                const isSelected = fullyRepaired === choice.value;
                return (
                  <button
                    key={choice.label}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setFullyRepaired(choice.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? choice.value
                          ? "border-foreground/30 bg-muted font-medium"
                          : "border-amber-500/50 bg-amber-500/10 font-medium text-amber-800 dark:text-amber-300"
                        : "border-border text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {!choice.value && (
                      <TriangleAlertIcon className="size-3.5" />
                    )}
                    {choice.label}
                  </button>
                );
              })}
            </div>
            {pending && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pending-issue" className="text-xs">
                  What still needs fixing
                </Label>
                <Input
                  id="pending-issue"
                  value={pendingIssue}
                  onChange={(event) => setPendingIssue(event.target.value)}
                  placeholder="e.g. Battery still drains fast, replacement on order"
                  aria-invalid={missingIssue || undefined}
                />
                <p className="text-[11px] text-muted-foreground">
                  The {noun} goes back into use with a Pending repair alert
                  until it&apos;s marked fixed.
                </p>
              </div>
            )}
          </div>
        )}

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
              retiring
                ? "e.g. Motherboard failure, not worth fixing"
                : "e.g. Keyboard replaced"
            }
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          variant={retiring ? "destructive" : "default"}
          disabled={missingIssue}
          onClick={() =>
            onConfirm(
              outcome,
              note.trim(),
              pending ? pendingIssue.trim() : null,
            )
          }
        >
          {retiring
            ? `Retire ${noun}`
            : pending
              ? "Release with pending repair"
              : "Release as repaired"}
        </Button>
      </DialogFooter>
    </>
  );
}
