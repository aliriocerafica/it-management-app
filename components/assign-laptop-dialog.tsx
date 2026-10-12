"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  LaptopIcon,
  PenLineIcon,
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
import {
  priorityStyles,
  requestCode,
  type AssetRequest,
} from "@/lib/asset-requests";
import { type Employee } from "@/lib/employees";
import { samePerson } from "@/lib/issue-stock";
import { useEmployeeDirectory } from "@/lib/use-employee-directory";
import { initials, type TrackedItem } from "@/lib/laptops";
import { cn } from "@/lib/utils";

export const MANUAL = "manual";
const NO_REQUEST = "__none__";

export function AssignLaptopDialog({
  laptop,
  laptops,
  requests = [],
  open,
  onOpenChange,
  onAssign,
  noun = "laptop",
  icon = LaptopIcon,
}: {
  laptop: TrackedItem | null;
  laptops: TrackedItem[];
  // Open requests (Pending/Approved) for this item's asset type, so the
  // person assigning it can say which request it fulfills.
  requests?: AssetRequest[];
  noun?: string;
  icon?: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (
    employee: Employee,
    note: string,
    request: AssetRequest | null,
  ) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && laptop && (
          <AssignForm
            key={laptop.assetTag}
            laptop={laptop}
            laptops={laptops}
            requests={requests}
            onAssign={onAssign}
            noun={noun}
            icon={icon}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// A name typed in the search box that isn't in the directory. People missing
// from HRIS (or HRIS being down) can still be typed in.
export function typedEmployee(query: string, employees: Employee[]) {
  const typedName = query.trim().replace(/\s+/g, " ");
  const inDirectory = employees.some(
    (e) => e.name.toLowerCase() === typedName.toLowerCase(),
  );
  return { typedName, canTypeName: typedName.length > 0 && !inDirectory };
}

// The search box and employee list shared by the assign dialog and the
// handler picker on the "Add" forms.
export function EmployeePickList({
  employees,
  status,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  heldBy,
  noun,
}: {
  employees: Employee[];
  status: "loading" | "ready" | "error";
  query: string;
  onQueryChange: (query: string) => void;
  // An employee id, or MANUAL for the name typed in the search box.
  selectedId: string | null;
  onSelect: (id: string) => void;
  // Asset tags each person currently holds, by name.
  heldBy: Map<string, string[]>;
  noun: string;
}) {
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter(
        (e) =>
          !q ||
          [e.name, e.id, e.department, e.title, e.email].some((value) =>
            value.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => {
        const aHas = heldBy.has(a.name) ? 1 : 0;
        const bHas = heldBy.has(b.name) ? 1 : 0;
        return aHas - bHas || a.name.localeCompare(b.name);
      });
  }, [employees, query, heldBy]);
  const { typedName, canTypeName } = typedEmployee(query, employees);
  const manualSelected = selectedId === MANUAL && canTypeName;

  return (
    <>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={
            employees.length
              ? "Search, or type a full name"
              : "Type the employee's full name"
          }
          className="pl-8"
          autoFocus
        />
      </div>

      <div
        role="radiogroup"
        aria-label="Employees"
        aria-busy={status === "loading"}
        className="-mx-2 flex max-h-80 min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-1"
      >
        {canTypeName && (
          <button
            type="button"
            role="radio"
            aria-checked={manualSelected}
            onClick={() => onSelect(MANUAL)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              manualSelected
                ? "border-foreground/30 bg-muted"
                : "border-dashed border-border hover:bg-muted/60",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <PenLineIcon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">
                Assign to &ldquo;{typedName}&rdquo;
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Typed manually, not in the employee directory
              </div>
            </div>
            {heldBy.has(typedName) && (
              <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                Has {heldBy.get(typedName)!.join(", ")}
              </span>
            )}
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                manualSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-input",
              )}
            >
              {manualSelected && <CheckIcon className="size-3" />}
            </span>
          </button>
        )}
        {list.map((employee) => {
          const isSelected = employee.id === selectedId;
          const held = heldBy.get(employee.name);
          return (
            <button
              key={employee.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(employee.id)}
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
                  {[employee.id, employee.title, employee.department]
                    .filter(Boolean)
                    .join(" · ")}
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
        {list.length === 0 && !canTypeName && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {status === "loading"
              ? "Loading employees from HRIS…"
              : status === "error"
                ? "Couldn't reach the HRIS employee directory. Type the person's full name above."
                : employees.length
                  ? "No employees match your search."
                  : "No employees found in HRIS. Type the person's full name above."}
          </p>
        )}
      </div>
    </>
  );
}

function AssignForm({
  laptop,
  laptops,
  requests,
  onAssign,
  noun,
  icon: Icon,
}: {
  laptop: TrackedItem;
  laptops: TrackedItem[];
  requests: AssetRequest[];
  noun: string;
  icon: LucideIcon;
  onAssign: (
    employee: Employee,
    note: string,
    request: AssetRequest | null,
  ) => void;
}) {
  const { employees, status } = useEmployeeDirectory();
  const [query, setQuery] = useState("");
  // An employee id, or MANUAL for the name typed in the search box.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualDepartment, setManualDepartment] = useState("");
  const [note, setNote] = useState("");
  // null = not yet decided by the person assigning (auto-suggest from the
  // chosen employee's name); NO_REQUEST = explicitly not linking one.
  const [requestChoice, setRequestChoice] = useState<string | null>(null);

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

  const { typedName, canTypeName } = typedEmployee(query, employees);
  const manualSelected = selectedId === MANUAL && canTypeName;

  const selected: Employee | null = manualSelected
    ? {
        id: "",
        name: typedName,
        department: manualDepartment.trim(),
        title: "",
        email: "",
      }
    : (employees.find((e) => e.id === selectedId) ?? null);

  const suggestedRequest = selected
    ? (requests.find((r) => samePerson(r.requesterName, selected.name)) ?? null)
    : null;
  const selectedRequest =
    requestChoice === null
      ? suggestedRequest
      : requestChoice === NO_REQUEST
        ? null
        : (requests.find((r) => r.id === requestChoice) ?? null);

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
        <EmployeePickList
          employees={employees}
          status={status}
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedId}
          onSelect={setSelectedId}
          heldBy={heldBy}
          noun={noun}
        />

        {manualSelected && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-department" className="text-xs">
              Department
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="assign-department"
              value={manualDepartment}
              onChange={(event) => setManualDepartment(event.target.value)}
              placeholder="e.g. Operations"
            />
          </div>
        )}

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

        {requests.length > 0 && (
          <div
            role="radiogroup"
            aria-label="Fulfills request"
            className="flex flex-col gap-1.5 border-t border-border pt-3 pb-4"
          >
            <span className="text-xs font-medium">
              Fulfills a request?
              <span className="font-normal text-muted-foreground">
                {" "}
                (optional)
              </span>
            </span>
            <div className="flex flex-col gap-1">
              {requests.map((request) => {
                const isSelected = selectedRequest?.id === request.id;
                return (
                  <button
                    key={request.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setRequestChoice(request.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? "border-foreground/30 bg-muted"
                        : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {requestCode(request)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {request.requesterName}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
                        priorityStyles[request.priority],
                      )}
                    >
                      {request.priority}
                    </span>
                  </button>
                );
              })}
              {selectedRequest && (
                <button
                  type="button"
                  onClick={() => setRequestChoice(NO_REQUEST)}
                  className="self-start px-2.5 py-1 text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Don&apos;t link a request
                </button>
              )}
            </div>
            {selectedRequest && (
              <p className="text-[11px] text-muted-foreground">
                {requestCode(selectedRequest)} will be marked Completed once
                this is assigned.
              </p>
            )}
          </div>
        )}
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
          onClick={() =>
            selected && onAssign(selected, note.trim(), selectedRequest)
          }
        >
          <UserPlusIcon />
          Assign
        </Button>
      </DialogFooter>
    </>
  );
}
