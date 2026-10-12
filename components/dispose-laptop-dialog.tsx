"use client";

import { useState } from "react";
import {
  CheckIcon,
  CoinsIcon,
  GiftIcon,
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

export type DisposalOutcome = "sell" | "donate";

export type DisposalConfirm = (
  outcome: DisposalOutcome,
  input: { party: string; price: string; note: string },
) => void;

export function DisposeLaptopDialog({
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
  onConfirm: DisposalConfirm;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {laptop && (
          <DisposeForm
            key={laptop.assetTag}
            laptop={laptop}
            noun={noun}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisposeForm({
  laptop,
  noun,
  onConfirm,
}: {
  laptop: TrackedItem;
  noun: string;
  onConfirm: DisposalConfirm;
}) {
  const options: {
    value: DisposalOutcome;
    icon: LucideIcon;
    title: string;
    description: string;
  }[] = [
    {
      value: "sell",
      icon: CoinsIcon,
      title: "Sell it",
      description: "Record the sale price and who bought it.",
    },
    {
      value: "donate",
      icon: GiftIcon,
      title: "Donate it",
      description: "Record who or where it was donated to.",
    },
  ];

  const [outcome, setOutcome] = useState<DisposalOutcome>("sell");
  const [party, setParty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const selling = outcome === "sell";
  const missingPrice = selling && !price.trim();

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (missingPrice) return;
        onConfirm(outcome, {
          party: party.trim(),
          price: price.trim(),
          note: note.trim(),
        });
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <CoinsIcon className="size-4" />
          Dispose {noun}
        </DialogTitle>
        <DialogDescription>
          {laptop.brand} {laptop.model} ·{" "}
          <span className="font-mono text-xs">{laptop.assetTag}</span>
          <span className="mt-1 block">
            Takes it out of inventory for good. Status becomes Retired.
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div
          role="radiogroup"
          aria-label="Disposal outcome"
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

        {selling && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dispose-price" className="text-xs">
              Sale price
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                ₱
              </span>
              <Input
                id="dispose-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="e.g. 5,000"
                className="pl-6"
                aria-invalid={missingPrice || undefined}
                autoFocus
                required
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dispose-party" className="text-xs">
            {selling ? "Buyer" : "Recipient"}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="dispose-party"
            value={party}
            onChange={(event) => setParty(event.target.value)}
            placeholder={
              selling ? "e.g. Juan Dela Cruz" : "e.g. Local school, ABC Foundation"
            }
            autoFocus={!selling}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dispose-note" className="text-xs">
            Note
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="dispose-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Sold as-is, screen has dead pixels"
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" variant="destructive" disabled={missingPrice}>
          {selling ? <CoinsIcon /> : <GiftIcon />}
          {selling ? "Mark as sold" : "Mark as donated"}
        </Button>
      </DialogFooter>
    </form>
  );
}
