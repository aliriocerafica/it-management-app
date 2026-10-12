"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";

import {
  EmployeePickList,
  MANUAL,
  typedEmployee,
} from "@/components/assign-laptop-dialog";
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
import { type Employee } from "@/lib/employees";
import { useEmployeeDirectory } from "@/lib/use-employee-directory";

// Picks the handler for an item that's still being registered, with the same
// employee list as the assign dialog. Opens on top of the "Add" form.
export function EmployeePickerDialog({
  open,
  onOpenChange,
  holders,
  noun,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Existing items of this type, to show who already holds one.
  holders: { handler: string | null; assetTag: string }[];
  noun: string;
  onPick: (employee: Employee) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        {open && <PickerForm holders={holders} noun={noun} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerForm({
  holders,
  noun,
  onPick,
}: {
  holders: { handler: string | null; assetTag: string }[];
  noun: string;
  onPick: (employee: Employee) => void;
}) {
  const { employees, status } = useEmployeeDirectory();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const heldBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of holders) {
      if (!item.handler) continue;
      map.set(item.handler, [...(map.get(item.handler) ?? []), item.assetTag]);
    }
    return map;
  }, [holders]);

  const { typedName, canTypeName } = typedEmployee(query, employees);
  const selected: Employee | null =
    selectedId === MANUAL && canTypeName
      ? { id: "", name: typedName, department: "", title: "", email: "" }
      : (employees.find((e) => e.id === selectedId) ?? null);

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          Select handler
        </DialogTitle>
        <DialogDescription>
          Choose who this {noun} is assigned to.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-3 px-6 pt-4 pb-2">
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
          onClick={() => selected && onPick(selected)}
        >
          <CheckIcon />
          Select
        </Button>
      </DialogFooter>
    </>
  );
}
