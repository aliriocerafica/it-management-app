"use client";

import { useState } from "react";
import { WrenchIcon } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { type TrackedItem } from "@/lib/laptops";

export function SendToRepairDialog({
  laptop,
  open,
  onOpenChange,
  onConfirm,
}: {
  laptop: TrackedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (issue: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {laptop && (
          <SendForm key={laptop.assetTag} laptop={laptop} onConfirm={onConfirm} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SendForm({
  laptop,
  onConfirm,
}: {
  laptop: TrackedItem;
  onConfirm: (issue: string) => void;
}) {
  const [issue, setIssue] = useState("");
  const trimmed = issue.trim();

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onConfirm(trimmed);
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <WrenchIcon className="size-4" />
          Send to repair
        </DialogTitle>
        <DialogDescription>
          {laptop.brand} {laptop.model} ·{" "}
          <span className="font-mono text-xs">{laptop.assetTag}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5 px-6 py-5">
        <Label htmlFor="repair-issue" className="text-xs">
          What&apos;s wrong with it?
        </Label>
        <textarea
          id="repair-issue"
          value={issue}
          onChange={(event) => setIssue(event.target.value)}
          placeholder="e.g. Keyboard keys not responding, battery drains in 1 hour"
          rows={4}
          required
          autoFocus
          className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground">
          Shown on the item while it&apos;s in repair.
        </p>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={!trimmed}>
          <WrenchIcon />
          Send to repair
        </Button>
      </DialogFooter>
    </form>
  );
}
