"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  LaptopIcon,
  SearchIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { employees, type Employee } from "@/lib/employees";
import { initials, type TrackedItem } from "@/lib/laptops";
import { cn } from "@/lib/utils";

export function AssignLaptopDialog({
  laptop,
  laptops,
  open,
  onOpenChange,
  onAssign,
  noun = "laptop",
  icon = LaptopIcon,
}: {
  laptop: TrackedItem | null;
  laptops: TrackedItem[];
  noun?: string;
  icon?: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (employee: Employee, note: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {laptop && (
          <AssignForm
            laptop={laptop}
            laptops={laptops}
            onAssign={onAssign}
            noun={noun}
            icon={icon}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({
  laptop,
  laptops,
  onAssign,
  noun,
  icon: Icon,
}: {
  laptop: TrackedItem;
  laptops: TrackedItem[];
  noun: string;
  icon: LucideIcon;
  onAssign: (employee: Employee, note: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Asset tags each employee currently holds, so IT can spot people who
  // already have one before handing out another.
  const heldBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of laptops) {
      if (!l.handler) continue;
      map.set(l.handler, [...(map.get(l.handler) ?? []), l.assetTag]);
    }
    return map;
  }, [laptops]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter(
        (e) =>
          !q ||
          [e.name, e.department, e.title, e.email].some((value) =>
            value.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => {
        const aHas = heldBy.has(a.name) ? 1 : 0;
        const bHas = heldBy.has(b.name) ? 1 : 0;
        return aHas - bHas || a.name.localeCompare(b.name);
      });
  }, [query, heldBy]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          Assign {noun}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {laptop.brand} {laptop.model}
          <span aria-hidden>·</span>
          <span className="font-mono text-xs">{laptop.assetTag}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-3 px-6 pt-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, department or role"
            className="pl-8"
            autoFocus
          />
        </div>

        <div
          role="radiogroup"
          aria-label="Employees"
          className="-mx-2 flex max-h-80 min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-1"
        >
          {list.map((employee) => {
            const isSelected = employee.id === selectedId;
            const held = heldBy.get(employee.name);
            return (
              <button
                key={employee.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedId(employee.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? "border-foreground/30 bg-muted"
                    : "border-transparent hover:bg-muted/60",
                )}
              >
                <Avatar className="size-9 after:rounded-full">
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {initials(employee.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">
                    {employee.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {employee.title} · {employee.department}
                  </div>
                </div>
                {held ? (
                  <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                    Has {held.join(", ")}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    No {noun}
                  </span>
                )}
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
              No employees match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3 pb-4">
          <Label htmlFor="assign-note" className="text-xs">
            Note
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="assign-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. New hire onboarding"
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
        {selected && (
          <p className="mr-auto truncate text-sm text-muted-foreground">
            Assigning to{" "}
            <span className="font-medium text-foreground">{selected.name}</span>
          </p>
        )}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          disabled={!selected}
          onClick={() => selected && onAssign(selected, note.trim())}
        >
          <UserPlusIcon />
          Assign
        </Button>
      </DialogFooter>
    </>
  );
}
